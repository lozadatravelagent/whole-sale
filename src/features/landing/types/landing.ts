// Landing Page Domain Types

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  discount?: string;
  popular?: boolean;
  features: string[];
  cta: string;
  buttonVariant?: 'default' | 'outline';
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface Feature {
  icon: string;
  title: string;
  description: string;
}

export interface CRMFeature {
  icon: 'Users' | 'BarChart3' | 'Clock' | 'Zap';
  title: string;
  description: string;
}

export interface Testimonial {
  name: string;
  role: string;
  company?: string;
  quote: string;
  initials: string;
}

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
}

export interface NavigationItem {
  label: string;
  href: string;
}

export interface SocialLink {
  name: string;
  url: string;
  icon: string;
}
