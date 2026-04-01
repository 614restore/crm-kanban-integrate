import React, { useState } from 'react';
import { Contact } from '@/lib/crmData';
import { 
  Star, 
  ExternalLink, 
  Send, 
  CheckCircle, 
  MessageSquare,
  MapPin,
  Calendar,
  Phone,
  Mail,
  Award,
  ThumbsUp,
  Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/database';
import { useAuth } from '@/lib/authContext';

interface CustomerSurveyProps {
  contact: Contact;
  companyGoogleUrl?: string;
  onSurveyComplete?: (surveyData: SurveyResponse) => void;
  onClose?: () => void;
  autoTrigger?: boolean;
}

interface SurveyResponse {
  contactId: string;
  overallSatisfaction: number;
  workQuality: number;
  communication: number;
  timeliness: number;
  cleanup: number;
  wouldRecommend: boolean;
  feedback: string;
  willingToProvideTestimonial: boolean;
  submittedAt: string;
  leftReview: boolean;
}

const CustomerSurvey: React.FC<CustomerSurveyProps> = ({
  contact,
  companyGoogleUrl,
  onSurveyComplete,
  onClose,
  autoTrigger = false
}) => {
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(autoTrigger ? 0 : 1);
  const [surveyData, setSurveyData] = useState<Partial<SurveyResponse>>({
    contactId: contact.id,
    overallSatisfaction: 0,
    workQuality: 0,
    communication: 0,
    timeliness: 0,
    cleanup: 0,
    wouldRecommend: false,
    feedback: '',
    willingToProvideTestimonial: false,
    leftReview: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const StarRating: React.FC<{ 
    rating: number; 
    onChange: (rating: number) => void; 
    label: string;
    required?: boolean;
  }> = ({ rating, onChange, label, required = false }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-colors"
          >
            <Star 
              className={`w-8 h-8 ${
                star <= rating 
                  ? 'text-yellow-400 fill-yellow-400' 
                  : 'text-gray-300 hover:text-yellow-400'
              }`} 
            />
          </button>
        ))}
      </div>
      <div className="text-xs text-gray-500">
        {rating === 0 ? 'Click to rate' : 
         rating === 1 ? 'Poor' :
         rating === 2 ? 'Fair' :
         rating === 3 ? 'Good' :
         rating === 4 ? 'Very Good' :
         'Excellent'}
      </div>
    </div>
  );

  const handleSubmitSurvey = async () => {
    if (!surveyData.overallSatisfaction || surveyData.overallSatisfaction === 0) {
      toast.error('Please provide an overall satisfaction rating');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const completedSurvey: SurveyResponse = {
        ...surveyData,
        submittedAt: new Date().toISOString()
      } as SurveyResponse;

      // 1. Persist survey record to Supabase
      const companyId = profile?.company_id;
      if (companyId) {
        const { error: surveyError } = await supabase
          .from('customer_surveys')
          .insert({
            company_id: companyId,
            contact_id: contact.id,
            overall_satisfaction: completedSurvey.overallSatisfaction,
            work_quality: completedSurvey.workQuality,
            communication: completedSurvey.communication,
            timeliness: completedSurvey.timeliness,
            cleanup: completedSurvey.cleanup,
            would_recommend: completedSurvey.wouldRecommend,
            feedback: completedSurvey.feedback,
            willing_to_provide_testimonial: completedSurvey.willingToProvideTestimonial,
            left_review: completedSurvey.leftReview,
            submitted_at: completedSurvey.submittedAt,
          });

        if (surveyError) {
          console.error('[CustomerSurvey] Failed to save survey to Supabase:', surveyError);
          // Non-fatal — still create comm note and fire callback
        }

        // 2. Create a communication note summarising the survey
        const surveyNote = `Customer survey completed — Overall satisfaction: ${completedSurvey.overallSatisfaction}/5 stars. ${
          completedSurvey.wouldRecommend ? 'Would recommend.' : 'Would not recommend.'
        }${completedSurvey.feedback ? ` Feedback: "${completedSurvey.feedback}"` : ''}`;

        await db.createCommunication({
          company_id: companyId,
          contact_id: contact.id,
          type: 'note',
          direction: 'inbound',
          content: surveyNote,
          user_id: profile?.id,
        });
      }

      // 3. Fire the callback with the full data so ContactDetail can update its state
      onSurveyComplete?.(completedSurvey);

      setShowThankYou(true);
      toast.success('Thank you for your feedback!');
      
    } catch (error) {
      console.error('[CustomerSurvey] Error submitting survey:', error);
      toast.error('Failed to submit survey. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openGoogleReview = () => {
    if (!companyGoogleUrl) {
      toast.error('No Google review link configured. Set it in Settings → Company Profile.');
      return;
    }
    window.open(companyGoogleUrl, '_blank', 'noopener,noreferrer');
    setSurveyData(prev => ({ ...prev, leftReview: true }));
    toast.success('Thank you for leaving a review!');
  };

  if (showThankYou) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-md mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Thank You!</h3>
          <p className="text-gray-600 mb-6">
            Your feedback helps us continue providing excellent service.
          </p>
          
          {surveyData.overallSatisfaction! >= 4 && companyGoogleUrl && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-blue-900 mb-2">Help Others Find Us!</h4>
              <p className="text-sm text-blue-700 mb-3">
                Would you mind sharing your positive experience on Google?
              </p>
              <button
                onClick={openGoogleReview}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Leave Google Review
              </button>
            </div>
          )}
          
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-md mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Project Completed!
          </h3>
          <p className="text-gray-600 mb-6">
            Hi {contact.firstName}! We've finished your project and would love to hear about your experience.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => setCurrentStep(1)}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Share Feedback
            </button>
            {companyGoogleUrl && (
              <button
                onClick={openGoogleReview}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Leave Google Review
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">How Did We Do?</h2>
          <p className="text-gray-600">
            Your feedback helps us continue providing excellent service to you and future customers.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Project Summary</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{contact.address}, {contact.city}, {contact.state}</span>
            </div>
            {contact.projectType && (
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" />
                <span>{contact.projectType}</span>
              </div>
            )}
            {contact.projectValue && (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 text-center">$</span>
                <span>Project Value: ${contact.projectValue.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <StarRating
          rating={surveyData.overallSatisfaction || 0}
          onChange={(rating) => setSurveyData(prev => ({ ...prev, overallSatisfaction: rating }))}
          label="Overall Satisfaction"
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StarRating
            rating={surveyData.workQuality || 0}
            onChange={(rating) => setSurveyData(prev => ({ ...prev, workQuality: rating }))}
            label="Work Quality"
          />
          <StarRating
            rating={surveyData.communication || 0}
            onChange={(rating) => setSurveyData(prev => ({ ...prev, communication: rating }))}
            label="Communication"
          />
          <StarRating
            rating={surveyData.timeliness || 0}
            onChange={(rating) => setSurveyData(prev => ({ ...prev, timeliness: rating }))}
            label="Timeliness"
          />
          <StarRating
            rating={surveyData.cleanup || 0}
            onChange={(rating) => setSurveyData(prev => ({ ...prev, cleanup: rating }))}
            label="Cleanup"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Would you recommend us to friends and family?
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setSurveyData(prev => ({ ...prev, wouldRecommend: true }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                surveyData.wouldRecommend === true
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              Yes, definitely!
            </button>
            <button
              type="button"
              onClick={() => setSurveyData(prev => ({ ...prev, wouldRecommend: false }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                surveyData.wouldRecommend === false
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              No
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Additional Comments (Optional)
          </label>
          <textarea
            value={surveyData.feedback || ''}
            onChange={(e) => setSurveyData(prev => ({ ...prev, feedback: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Tell us more about your experience..."
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={surveyData.willingToProvideTestimonial || false}
              onChange={(e) => setSurveyData(prev => ({ ...prev, willingToProvideTestimonial: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              I'm willing to provide a testimonial for marketing materials
            </span>
          </label>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={handleSubmitSurvey}
          disabled={isSubmitting || !surveyData.overallSatisfaction}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>

        {surveyData.overallSatisfaction! >= 4 && companyGoogleUrl && (
          <button
            onClick={openGoogleReview}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Google Review
          </button>
        )}

        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default CustomerSurvey;
