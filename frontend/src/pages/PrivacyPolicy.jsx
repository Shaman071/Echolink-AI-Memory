import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <div className="space-y-4 text-gray-800 dark:text-gray-100">
        <p>
          <strong>EchoLink</strong> is committed to protecting your privacy and data rights. This policy explains how we handle your data:
        </p>
        <ul className="list-disc ml-6 space-y-2">
          <li>All uploaded files and fragments are stored securely and never shared with third parties.</li>
          <li>You may export or delete your data at any time from the Settings page.</li>
          <li>We comply with GDPR and CCPA. You have the right to access, rectify, erase, and restrict processing of your data.</li>
          <li>Data is encrypted at rest and in transit. Only you and authorized system processes can access your uploads.</li>
          <li>No personal data is used for advertising or profiling.</li>
        </ul>
        <p>
          For any privacy concerns or data requests, contact us at <a href="mailto:privacy@echolink.app" className="underline text-blue-700 dark:text-blue-300">privacy@echolink.app</a>.
        </p>
      </div>
    </div>
  );
}
