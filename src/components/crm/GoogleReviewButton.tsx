import React from 'react';
import { ExternalLink, Star, MapPin, Phone, Mail } from 'lucide-react';
import { Contact } from '@/lib/crmData';

interface GoogleReviewButtonProps {
  contact: Contact;
  companyName?: string;
  googleBusinessUrl?: string;
  className?: string;
}

const GoogleReviewButton: React.FC<GoogleReviewButtonProps> = ({
  contact,
  companyName = "TrussCTR", 
  googleBusinessUrl,
  className = ""
}) => {
  // Generate Google review URL
  const generateGoogleReviewUrl = () => {
    if (googleBusinessUrl) {
      return googleBusinessUrl;
    }
    
    // If no specific URL provided, generate a search URL
    const companyQuery = encodeURIComponent(`${companyName} reviews`);
    return `https://www.google.com/search?q=${companyQuery}`;
  };

  const handleGoogleReviewClick = () => {
    window.open(generateGoogleReviewUrl(), '_blank', 'noopener,noreferrer');
    
    // Track the review request (could be saved to analytics/database)
  };

  return (
    <button
      onClick={handleGoogleReviewClick}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium ${className}`}
    >
      <Star className="w-4 h-4" />
      Leave Google Review
      <ExternalLink className="w-4 h-4" />
    </button>
  );
};

export default GoogleReviewButton;