/**
 * Quality Scorer Tests
 * Tests for response quality scoring and feedback detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase server before importing (FeedbackTracker uses it)
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  QualityScorer,
  scoreResponse,
  meetsQualityThreshold,
  type QualityScore,
  type FeedbackSignal,
} from '@/lib/agents/orchestration/quality-scorer';

describe('Quality Scorer', () => {
  let scorer: QualityScorer;

  beforeEach(() => {
    scorer = new QualityScorer();
  });

  describe('QualityScorer.score', () => {
    describe('relevance scoring', () => {
      it('should score higher when response contains query words', () => {
        const query = 'How do I implement authentication?';
        const relevantResponse = 'To implement authentication, you need to verify user credentials.';
        const irrelevantResponse = 'The weather today is sunny and warm.';

        const relevantScore = scorer.score(relevantResponse, query);
        const irrelevantScore = scorer.score(irrelevantResponse, query);

        expect(relevantScore.dimensions.relevance).toBeGreaterThan(irrelevantScore.dimensions.relevance);
      });

      it('should handle empty queries gracefully', () => {
        const score = scorer.score('Some response text here.', '');
        expect(score.dimensions.relevance).toBe(0.5); // Default when no query words
      });
    });

    describe('completeness scoring', () => {
      it('should score higher for properly ended responses', () => {
        const properEnding = 'This is a complete response with proper ending.';
        const noEnding = 'This response just trails off without';

        const properScore = scorer.score(properEnding, 'test query');
        const noEndingScore = scorer.score(noEnding, 'test query');

        expect(properScore.dimensions.completeness).toBeGreaterThan(noEndingScore.dimensions.completeness);
      });

      it('should score lower for very short responses', () => {
        const shortResponse = 'Yes.';
        const normalResponse = 'Yes, that is correct. Here is a more detailed explanation of why this approach works and how you can implement it in your project.';

        const shortScore = scorer.score(shortResponse, 'Is this correct?');
        const normalScore = scorer.score(normalResponse, 'Is this correct?');

        expect(normalScore.dimensions.completeness).toBeGreaterThan(shortScore.dimensions.completeness);
      });

      it('should reward responses with examples', () => {
        const withExample = 'You can do this, for example, by using the forEach method.';
        const withoutExample = 'You can do this by using the forEach method.';

        const withExampleScore = scorer.score(withExample, 'How do I iterate?');
        const withoutExampleScore = scorer.score(withoutExample, 'How do I iterate?');

        expect(withExampleScore.dimensions.completeness).toBeGreaterThan(withoutExampleScore.dimensions.completeness);
      });
    });

    describe('clarity scoring', () => {
      it('should penalize hedging language', () => {
        const confident = 'The solution is to use async/await syntax.';
        const hedging = 'Maybe you could possibly try using async/await, I think.';

        const confidentScore = scorer.score(confident, 'test');
        const hedgingScore = scorer.score(hedging, 'test');

        expect(confidentScore.dimensions.clarity).toBeGreaterThan(hedgingScore.dimensions.clarity);
      });

      it('should reward confident language', () => {
        const confident = 'This definitely solves the problem. Certainly, use this approach.';
        const neutral = 'This solves the problem. Use this approach.';

        const confidentScore = scorer.score(confident, 'test');
        const neutralScore = scorer.score(neutral, 'test');

        expect(confidentScore.dimensions.clarity).toBeGreaterThan(neutralScore.dimensions.clarity);
      });

      it('should reward structured responses', () => {
        const structured = '1. First step\n2. Second step\n3. Third step';
        const unstructured = 'First do this then do that and finally do the last thing.';

        const structuredScore = scorer.score(structured, 'test');
        const unstructuredScore = scorer.score(unstructured, 'test');

        expect(structuredScore.dimensions.clarity).toBeGreaterThan(unstructuredScore.dimensions.clarity);
      });
    });

    describe('helpfulness scoring', () => {
      it('should reward actionable content', () => {
        const actionable = 'Run npm install to install dependencies, then open the config file.';
        const passive = 'The dependencies are installed and the config file exists.';

        const actionableScore = scorer.score(actionable, 'test');
        const passiveScore = scorer.score(passive, 'test');

        expect(actionableScore.dimensions.helpfulness).toBeGreaterThan(passiveScore.dimensions.helpfulness);
      });

      it('should reward code snippets', () => {
        const withCode = 'Use this code: `const x = 1;` to define the variable.';
        const withoutCode = 'Use a constant to define the variable.';

        const withCodeScore = scorer.score(withCode, 'test');
        const withoutCodeScore = scorer.score(withoutCode, 'test');

        expect(withCodeScore.dimensions.helpfulness).toBeGreaterThan(withoutCodeScore.dimensions.helpfulness);
      });

      it('should reward citations and URLs', () => {
        const withCitation = 'According to the docs [1], you should use https://example.com/api.';
        const withoutCitation = 'According to the docs, you should use the API.';

        const withCitationScore = scorer.score(withCitation, 'test');
        const withoutCitationScore = scorer.score(withoutCitation, 'test');

        expect(withCitationScore.dimensions.helpfulness).toBeGreaterThan(withoutCitationScore.dimensions.helpfulness);
      });

      it('should penalize refusals', () => {
        const helpful = 'Here is how to solve your problem.';
        const refusing = "I can't help with that request. I am unable to assist.";

        const helpfulScore = scorer.score(helpful, 'test');
        const refusingScore = scorer.score(refusing, 'test');

        expect(helpfulScore.dimensions.helpfulness).toBeGreaterThan(refusingScore.dimensions.helpfulness);
      });

      it('should reward list format', () => {
        const withList = 'Here are the steps:\n- First item\n- Second item\n- Third item';
        const withoutList = 'Here are the steps: First item, second item, third item.';

        const withListScore = scorer.score(withList, 'test');
        const withoutListScore = scorer.score(withoutList, 'test');

        expect(withListScore.dimensions.helpfulness).toBeGreaterThan(withoutListScore.dimensions.helpfulness);
      });
    });

    describe('flags detection', () => {
      it('should detect code blocks', () => {
        const withCodeBlock = 'Here is an example:\n```javascript\nconst x = 1;\n```';
        const withInlineCode = 'Use `const x = 1;` to define it.';
        const withoutCode = 'Use a constant to define it.';

        expect(scorer.score(withCodeBlock, 'test').flags.containsCode).toBe(true);
        expect(scorer.score(withInlineCode, 'test').flags.containsCode).toBe(true);
        expect(scorer.score(withoutCode, 'test').flags.containsCode).toBe(false);
      });

      it('should detect citations', () => {
        const withBracketCitation = 'According to source [1], this is correct.';
        const withYearCitation = 'As Smith (2023) noted, this is important.';
        const withUrl = 'See https://example.com for more info.';
        const withoutCitation = 'This is correct according to experts.';

        expect(scorer.score(withBracketCitation, 'test').flags.containsCitations).toBe(true);
        expect(scorer.score(withYearCitation, 'test').flags.containsCitations).toBe(true);
        expect(scorer.score(withUrl, 'test').flags.containsCitations).toBe(true);
        expect(scorer.score(withoutCitation, 'test').flags.containsCitations).toBe(false);
      });

      it('should detect structured responses', () => {
        const numbered = '1. First\n2. Second';
        const bulleted = '- First\n- Second';
        const prose = 'First, then second.';

        expect(scorer.score(numbered, 'test').flags.isStructured).toBe(true);
        expect(scorer.score(bulleted, 'test').flags.isStructured).toBe(true);
        expect(scorer.score(prose, 'test').flags.isStructured).toBe(false);
      });

      it('should detect actionable content', () => {
        const actionable = 'Click the button to open the menu.';
        const descriptive = 'The button shows a menu.';

        expect(scorer.score(actionable, 'test').flags.isActionable).toBe(true);
        expect(scorer.score(descriptive, 'test').flags.isActionable).toBe(false);
      });
    });

    describe('overall scoring', () => {
      it('should return overall score between 0 and 1', () => {
        const score = scorer.score('Any response text.', 'Any query');
        expect(score.overall).toBeGreaterThanOrEqual(0);
        expect(score.overall).toBeLessThanOrEqual(1);
      });

      it('should score high-quality responses higher', () => {
        const highQuality = `Here is how to implement authentication in your app:

1. First, install the required dependencies by running \`npm install passport\`
2. Create an authentication middleware
3. Configure your routes, for example:

\`\`\`javascript
app.post('/login', authenticate);
\`\`\`

See https://passportjs.org for more details.`;

        const lowQuality = 'Maybe try authentication I think.';

        const highScore = scorer.score(highQuality, 'How do I implement authentication?');
        const lowScore = scorer.score(lowQuality, 'How do I implement authentication?');

        expect(highScore.overall).toBeGreaterThan(lowScore.overall);
        expect(highScore.overall).toBeGreaterThan(0.6);
        expect(lowScore.overall).toBeLessThan(0.5);
      });
    });
  });

  describe('detectImplicitFeedback', () => {
    it('should detect regeneration requests', () => {
      const feedback = scorer.detectImplicitFeedback('Try again please', 'previous response', 5000);

      expect(feedback).not.toBeNull();
      expect(feedback!.signal).toBe('negative');
      expect(feedback!.source).toBe('regenerate');
      expect(feedback!.strength).toBe(0.7);
    });

    it('should detect retry keywords', () => {
      const phrases = ['Do it again', 'Retry that', 'Regenerate the response', 'Redo this'];

      for (const phrase of phrases) {
        const feedback = scorer.detectImplicitFeedback(phrase, 'response', 1000);
        expect(feedback?.source).toBe('regenerate');
      }
    });

    it('should detect positive sentiment', () => {
      const positives = ['Thanks!', 'Perfect answer', 'Great job', 'Awesome', 'Very helpful', 'Exactly what I needed'];

      for (const phrase of positives) {
        const feedback = scorer.detectImplicitFeedback(phrase, 'response', 5000);
        expect(feedback?.signal).toBe('positive');
        expect(feedback?.source).toBe('sentiment');
      }
    });

    it('should detect negative sentiment', () => {
      const negatives = ["That's wrong", 'Incorrect answer', "No, that's not it", "Doesn't work"];

      for (const phrase of negatives) {
        const feedback = scorer.detectImplicitFeedback(phrase, 'response', 5000);
        expect(feedback?.signal).toBe('negative');
        expect(feedback?.source).toBe('sentiment');
      }
    });

    it('should detect follow-up questions', () => {
      const feedback = scorer.detectImplicitFeedback(
        'Can you explain more about that?',
        'previous response',
        30000 // 30 seconds
      );

      expect(feedback).not.toBeNull();
      expect(feedback!.signal).toBe('neutral');
      expect(feedback!.source).toBe('followup');
    });

    it('should not detect follow-up if too much time passed', () => {
      const feedback = scorer.detectImplicitFeedback(
        'Can you explain more?',
        'previous response',
        120000 // 2 minutes - beyond the 60s threshold
      );

      // Should still return null because no other patterns match
      // (the question mark alone doesn't trigger feedback without matching patterns)
      expect(feedback).toBeNull();
    });

    it('should return null for neutral messages', () => {
      const feedback = scorer.detectImplicitFeedback(
        'I want to build a website',
        'previous response',
        120000
      );

      expect(feedback).toBeNull();
    });
  });

  describe('isWorthCaching', () => {
    it('should return true for high-quality scores', () => {
      const highQualityScore: QualityScore = {
        overall: 0.85,
        dimensions: { relevance: 0.9, completeness: 0.8, clarity: 0.85, accuracy: 0.8, helpfulness: 0.85 },
        flags: { containsCode: true, containsCitations: false, isStructured: true, isActionable: true },
      };

      expect(scorer.isWorthCaching(highQualityScore)).toBe(true);
    });

    it('should return false for low-quality scores', () => {
      const lowQualityScore: QualityScore = {
        overall: 0.45,
        dimensions: { relevance: 0.4, completeness: 0.5, clarity: 0.4, accuracy: 0.45, helpfulness: 0.4 },
        flags: { containsCode: false, containsCitations: false, isStructured: false, isActionable: false },
      };

      expect(scorer.isWorthCaching(lowQualityScore)).toBe(false);
    });

    it('should use custom config threshold', () => {
      const customScorer = new QualityScorer({ minScoreForCache: 0.9 });
      const mediumScore: QualityScore = {
        overall: 0.85,
        dimensions: { relevance: 0.8, completeness: 0.8, clarity: 0.8, accuracy: 0.8, helpfulness: 0.8 },
        flags: { containsCode: false, containsCitations: false, isStructured: false, isActionable: false },
      };

      expect(customScorer.isWorthCaching(mediumScore)).toBe(false);
    });
  });

  describe('adjustScoreWithFeedback', () => {
    it('should increase score for positive feedback', () => {
      const score: QualityScore = {
        overall: 0.7,
        dimensions: { relevance: 0.7, completeness: 0.7, clarity: 0.7, accuracy: 0.7, helpfulness: 0.7 },
        flags: { containsCode: false, containsCitations: false, isStructured: false, isActionable: false },
      };

      const feedback: FeedbackSignal = {
        type: 'implicit',
        signal: 'positive',
        source: 'sentiment',
        strength: 0.8,
        timestamp: Date.now(),
      };

      const adjusted = scorer.adjustScoreWithFeedback(score, feedback);
      expect(adjusted.overall).toBeGreaterThan(score.overall);
    });

    it('should decrease score for negative feedback', () => {
      const score: QualityScore = {
        overall: 0.7,
        dimensions: { relevance: 0.7, completeness: 0.7, clarity: 0.7, accuracy: 0.7, helpfulness: 0.7 },
        flags: { containsCode: false, containsCitations: false, isStructured: false, isActionable: false },
      };

      const feedback: FeedbackSignal = {
        type: 'implicit',
        signal: 'negative',
        source: 'regenerate',
        strength: 0.7,
        timestamp: Date.now(),
      };

      const adjusted = scorer.adjustScoreWithFeedback(score, feedback);
      expect(adjusted.overall).toBeLessThan(score.overall);
    });

    it('should not change score for neutral feedback', () => {
      const score: QualityScore = {
        overall: 0.7,
        dimensions: { relevance: 0.7, completeness: 0.7, clarity: 0.7, accuracy: 0.7, helpfulness: 0.7 },
        flags: { containsCode: false, containsCitations: false, isStructured: false, isActionable: false },
      };

      const feedback: FeedbackSignal = {
        type: 'implicit',
        signal: 'neutral',
        source: 'followup',
        strength: 0.5,
        timestamp: Date.now(),
      };

      const adjusted = scorer.adjustScoreWithFeedback(score, feedback);
      expect(adjusted.overall).toBe(score.overall);
    });

    it('should clamp adjusted score to 0-1 range', () => {
      const highScore: QualityScore = {
        overall: 0.95,
        dimensions: { relevance: 0.95, completeness: 0.95, clarity: 0.95, accuracy: 0.95, helpfulness: 0.95 },
        flags: { containsCode: false, containsCitations: false, isStructured: false, isActionable: false },
      };

      const lowScore: QualityScore = {
        overall: 0.1,
        dimensions: { relevance: 0.1, completeness: 0.1, clarity: 0.1, accuracy: 0.1, helpfulness: 0.1 },
        flags: { containsCode: false, containsCitations: false, isStructured: false, isActionable: false },
      };

      const positiveFeedback: FeedbackSignal = {
        type: 'explicit',
        signal: 'positive',
        source: 'thumbs',
        strength: 1.0,
        timestamp: Date.now(),
      };

      const negativeFeedback: FeedbackSignal = {
        type: 'explicit',
        signal: 'negative',
        source: 'thumbs',
        strength: 1.0,
        timestamp: Date.now(),
      };

      const boosted = scorer.adjustScoreWithFeedback(highScore, positiveFeedback);
      const penalized = scorer.adjustScoreWithFeedback(lowScore, negativeFeedback);

      expect(boosted.overall).toBeLessThanOrEqual(1);
      expect(penalized.overall).toBeGreaterThanOrEqual(0);
    });
  });

  describe('utility functions', () => {
    describe('scoreResponse', () => {
      it('should return a quality score', () => {
        const score = scoreResponse('This is a helpful response.', 'Test query');

        expect(score).toHaveProperty('overall');
        expect(score).toHaveProperty('dimensions');
        expect(score).toHaveProperty('flags');
      });
    });

    describe('meetsQualityThreshold', () => {
      it('should return true when score meets default threshold', () => {
        const score: QualityScore = {
          overall: 0.75,
          dimensions: { relevance: 0.7, completeness: 0.7, clarity: 0.7, accuracy: 0.7, helpfulness: 0.7 },
          flags: { containsCode: false, containsCitations: false, isStructured: false, isActionable: false },
        };

        expect(meetsQualityThreshold(score)).toBe(true);
      });

      it('should return false when score is below threshold', () => {
        const score: QualityScore = {
          overall: 0.5,
          dimensions: { relevance: 0.5, completeness: 0.5, clarity: 0.5, accuracy: 0.5, helpfulness: 0.5 },
          flags: { containsCode: false, containsCitations: false, isStructured: false, isActionable: false },
        };

        expect(meetsQualityThreshold(score)).toBe(false);
      });

      it('should respect custom threshold', () => {
        const score: QualityScore = {
          overall: 0.75,
          dimensions: { relevance: 0.7, completeness: 0.7, clarity: 0.7, accuracy: 0.7, helpfulness: 0.7 },
          flags: { containsCode: false, containsCitations: false, isStructured: false, isActionable: false },
        };

        expect(meetsQualityThreshold(score, 0.8)).toBe(false);
        expect(meetsQualityThreshold(score, 0.6)).toBe(true);
      });
    });
  });
});
