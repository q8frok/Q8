/**
 * Finance AI Tools
 * Tools for the AI advisor to query and analyze financial data
 */

import type { OpenAITool } from '../types';

/**
 * Finance tool definitions for OpenAI function calling
 */
export const financeTools: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'get_balance_sheet',
      description:
        'Get a summary of the user\'s current financial position including net worth, assets, liabilities, and account balances. Use this to answer questions about current finances.',
      parameters: {
        type: 'object',
        properties: {
          include_hidden: {
            type: 'boolean',
            description: 'Include hidden accounts in the summary. Defaults to false.',
          },
          group_by: {
            type: 'string',
            enum: ['type', 'institution', 'none'],
            description: 'How to group accounts. Defaults to "type".',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_spending_summary',
      description:
        'Get a summary of spending by category for a given time period. Use this to analyze where money is going.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['7d', '30d', '90d', 'ytd', 'all'],
            description: 'Time period to analyze. Defaults to "30d".',
          },
          category: {
            type: 'string',
            description: 'Optional: filter to a specific category (e.g., "Food and Drink", "Shopping")',
          },
          limit: {
            type: 'number',
            description: 'Number of top categories to return. Defaults to 10.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_transactions',
      description:
        'Get recent transactions, optionally filtered by merchant, category, or amount range.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of transactions to return. Defaults to 10.',
          },
          merchant: {
            type: 'string',
            description: 'Filter by merchant name (partial match)',
          },
          category: {
            type: 'string',
            description: 'Filter by category',
          },
          min_amount: {
            type: 'number',
            description: 'Minimum transaction amount (absolute value)',
          },
          max_amount: {
            type: 'number',
            description: 'Maximum transaction amount (absolute value)',
          },
          type: {
            type: 'string',
            enum: ['expense', 'income', 'all'],
            description: 'Filter by transaction type. Defaults to "all".',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_bills',
      description:
        'Get upcoming recurring bills and their due dates. Use this to help users plan for upcoming expenses.',
      parameters: {
        type: 'object',
        properties: {
          days_ahead: {
            type: 'number',
            description: 'Number of days to look ahead. Defaults to 30.',
          },
          include_paid: {
            type: 'boolean',
            description: 'Include already paid/confirmed bills. Defaults to false.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'can_i_afford',
      description:
        'Analyze whether the user can afford a purchase based on their current finances, upcoming bills, and spending patterns. Provides a recommendation with reasoning.',
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'The amount of the potential purchase',
          },
          description: {
            type: 'string',
            description: 'What the purchase is for (helps with categorization)',
          },
          use_credit: {
            type: 'boolean',
            description: 'Whether to consider using credit. Defaults to false.',
          },
          timeline: {
            type: 'string',
            enum: ['now', 'this_week', 'this_month', 'save_up'],
            description: 'When the user wants to make the purchase. Defaults to "now".',
          },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simulate_wealth',
      description:
        'Run a wealth simulation to project future net worth based on current finances and assumptions. Use this for retirement planning, savings goals, and financial projections.',
      parameters: {
        type: 'object',
        properties: {
          years: {
            type: 'number',
            description: 'Number of years to project. Defaults to 10.',
          },
          monthly_contribution: {
            type: 'number',
            description: 'Monthly savings/investment amount. Defaults to current average.',
          },
          expected_return: {
            type: 'number',
            description: 'Expected annual return rate as percentage (e.g., 7 for 7%). Defaults to 7.',
          },
          inflation_rate: {
            type: 'number',
            description: 'Expected inflation rate as percentage. Defaults to 2.5.',
          },
          major_expenses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                amount: { type: 'number' },
                year: { type: 'number' },
              },
            },
            description: 'List of major planned expenses (e.g., house, car, wedding)',
          },
          goal_amount: {
            type: 'number',
            description: 'Target net worth to reach. If set, will calculate time to reach goal.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_net_worth_history',
      description:
        'Get historical net worth data to show trends over time.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['7d', '30d', '90d', '1y', 'all'],
            description: 'Time period to retrieve. Defaults to "30d".',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_subscriptions',
      description:
        'Identify recurring subscriptions and memberships from transaction history. Useful for finding potential savings.',
      parameters: {
        type: 'object',
        properties: {
          include_cancelled: {
            type: 'boolean',
            description: 'Include subscriptions that may have been cancelled. Defaults to false.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_spending',
      description:
        'Compare spending between two time periods to identify changes and trends.',
      parameters: {
        type: 'object',
        properties: {
          period1: {
            type: 'string',
            enum: ['last_week', 'last_month', 'last_quarter'],
            description: 'First period to compare',
          },
          period2: {
            type: 'string',
            enum: ['this_week', 'this_month', 'this_quarter'],
            description: 'Second period to compare',
          },
          category: {
            type: 'string',
            description: 'Optional: focus on a specific category',
          },
        },
        required: ['period1', 'period2'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_insights',
      description:
        'Get AI-generated insights about spending patterns, anomalies, and recommendations. Use this for personalized financial advice.',
      parameters: {
        type: 'object',
        properties: {
          focus: {
            type: 'string',
            enum: ['spending', 'savings', 'debt', 'investments', 'all'],
            description: 'Area to focus insights on. Defaults to "all".',
          },
        },
        required: [],
      },
    },
  },
];

export default financeTools;
