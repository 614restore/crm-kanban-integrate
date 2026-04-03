import React from 'react';
import { X, User, Phone, Mail, MapPin, AlertTriangle } from 'lucide-react';
import type { DbContact } from '@/lib/database';

interface DuplicateContactDialogProps {
  isOpen: boolean;
  duplicates: DbContact[];
  onClose: () => void;
  onCreateAnyway: () => void;
  onViewContact: (contactId: string) => void;
}

export default function DuplicateContactDialog({
  isOpen,
  duplicates,
  onClose,
  onCreateAnyway,
  onViewContact,
}: DuplicateContactDialogProps) {
  if (!isOpen) return null;

  const getContactFullName = (contact: DbContact) => {
    return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="text-yellow-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Possible Duplicate Contact</h2>
              <p className="text-sm text-gray-500">
                {duplicates.length} similar contact{duplicates.length > 1 ? 's' : ''} found
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-gray-700 mb-6">
            We found {duplicates.length} existing contact{duplicates.length > 1 ? 's' : ''} with similar information.
            Would you like to view {duplicates.length > 1 ? 'one of them' : 'it'} instead of creating a duplicate?
          </p>

          <div className="space-y-3">
            {duplicates.map((contact) => (
              <div
                key={contact.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer"
                onClick={() => onViewContact(contact.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <User size={16} className="text-gray-400" />
                      <h3 className="font-semibold text-gray-900">
                        {getContactFullName(contact)}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        contact.status === 'lead' ? 'bg-blue-100 text-blue-700' :
                        contact.status === 'customer' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {contact.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      {contact.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail size={14} className="text-gray-400" />
                          <span>{contact.email}</span>
                        </div>
                      )}
                      {contact.phone1 && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone size={14} className="text-gray-400" />
                          <span>{contact.phone1}</span>
                        </div>
                      )}
                      {contact.address && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin size={14} className="text-gray-400" />
                          <span>
                            {contact.address}
                            {contact.city && `, ${contact.city}`}
                            {contact.state && `, ${contact.state}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {contact.notes && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                        {contact.notes}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewContact(contact.id);
                    }}
                    className="ml-4 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <div className="flex gap-3">
              <button
                onClick={onCreateAnyway}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
              >
                Create Anyway
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            💡 Tip: You can add multiple projects to existing contacts instead of creating duplicates
          </p>
        </div>
      </div>
    </div>
  );
}
