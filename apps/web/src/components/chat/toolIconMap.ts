import {
  Lightbulb,
  Thermometer,
  Search,
  Mail,
  Calendar,
  Database,
  Github,
  Clock,
  Calculator,
  Cloud,
  Home,
  Lock,
  Music,
  Tv,
  Blinds,
  ImageIcon,
  ScanLine,
  Wand2,
  DollarSign,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Brain,
  FileText,
  Globe,
  BookOpen,
  Shield,
  Zap,
  Bell,
  Cog,
  Play,
  Pause,
  SkipForward,
  Volume2,
  Trash2,
  Copy,
  RefreshCw,
} from 'lucide-react';

/**
 * Get icon for a tool based on its name
 */
export function getToolIcon(tool: string) {
  const toolLower = tool.toLowerCase();

  // Image tools
  if (toolLower.includes('generate_image') || toolLower.includes('create_image')) {
    return Wand2;
  }
  if (toolLower.includes('analyze_image') || toolLower.includes('describe_image')) {
    return ScanLine;
  }
  if (toolLower.includes('image') || toolLower.includes('picture') || toolLower.includes('photo')) {
    return ImageIcon;
  }

  // Finance tools
  if (toolLower.includes('balance') || toolLower.includes('net_worth')) {
    return DollarSign;
  }
  if (toolLower.includes('spending') || toolLower.includes('transaction') || toolLower.includes('payment')) {
    return CreditCard;
  }
  if (toolLower.includes('savings') || toolLower.includes('budget')) {
    return PiggyBank;
  }
  if (toolLower.includes('wealth') || toolLower.includes('invest') || toolLower.includes('portfolio')) {
    return TrendingUp;
  }
  if (toolLower.includes('subscription') || toolLower.includes('recurring') || toolLower.includes('bill')) {
    return RefreshCw;
  }

  // Home Assistant tools - expanded
  if (toolLower.includes('light') || toolLower.includes('control_device')) {
    return Lightbulb;
  }
  if (toolLower.includes('climate') || toolLower.includes('thermostat') || toolLower.includes('temperature')) {
    return Thermometer;
  }
  if (toolLower.includes('lock') || toolLower.includes('door')) {
    return Lock;
  }
  if (toolLower.includes('alarm') || toolLower.includes('security')) {
    return Shield;
  }
  if (toolLower.includes('energy') || toolLower.includes('power')) {
    return Zap;
  }
  if (toolLower.includes('notification') || toolLower.includes('alert')) {
    return Bell;
  }
  if (toolLower.includes('automation') || toolLower.includes('script')) {
    return Cog;
  }
  if (toolLower.includes('vacuum') || toolLower.includes('robot')) {
    return Home;
  }
  if (toolLower.includes('sensor')) {
    return ScanLine;
  }
  if (toolLower.includes('media') || toolLower.includes('music') || toolLower.includes('speaker')) {
    return Music;
  }
  if (toolLower.includes('tv') || toolLower.includes('scene')) {
    return Tv;
  }
  if (toolLower.includes('cover') || toolLower.includes('blind')) {
    return Blinds;
  }
  if (toolLower.includes('play') || toolLower.includes('start')) {
    return Play;
  }
  if (toolLower.includes('pause') || toolLower.includes('stop')) {
    return Pause;
  }
  if (toolLower.includes('next') || toolLower.includes('skip')) {
    return SkipForward;
  }
  if (toolLower.includes('volume')) {
    return Volume2;
  }
  if (toolLower.includes('discover') || toolLower.includes('find_device')) {
    return Search;
  }
  if (toolLower.includes('home') || toolLower.includes('device')) {
    return Home;
  }

  // Knowledge/Memory tools
  if (toolLower.includes('memory') || toolLower.includes('recall') || toolLower.includes('remember')) {
    return Brain;
  }
  if (toolLower.includes('document') || toolLower.includes('file') || toolLower.includes('read')) {
    return FileText;
  }

  // Research tools
  if (toolLower.includes('web_search') || toolLower.includes('perplexity')) {
    return Globe;
  }
  if (toolLower.includes('research') || toolLower.includes('lookup') || toolLower.includes('learn')) {
    return BookOpen;
  }

  // Google tools
  if (toolLower.includes('gmail') || toolLower.includes('email') || toolLower.includes('send_email')) {
    return Mail;
  }
  if (toolLower.includes('calendar') || toolLower.includes('event') || toolLower.includes('schedule')) {
    return Calendar;
  }

  // GitHub tools
  if (toolLower.includes('github') || toolLower.includes('pr') || toolLower.includes('issue') || toolLower.includes('commit')) {
    return Github;
  }

  // Database tools
  if (toolLower.includes('supabase') || toolLower.includes('sql') || toolLower.includes('database') || toolLower.includes('query')) {
    return Database;
  }

  // Utility tools
  if (toolLower.includes('search')) {
    return Search;
  }
  if (toolLower.includes('time') || toolLower.includes('datetime') || toolLower.includes('date')) {
    return Clock;
  }
  if (toolLower.includes('calculate') || toolLower.includes('math') || toolLower.includes('compute')) {
    return Calculator;
  }
  if (toolLower.includes('weather') || toolLower.includes('forecast')) {
    return Cloud;
  }
  if (toolLower.includes('delete') || toolLower.includes('remove')) {
    return Trash2;
  }
  if (toolLower.includes('copy') || toolLower.includes('duplicate')) {
    return Copy;
  }

  // Default
  return Cog;
}
