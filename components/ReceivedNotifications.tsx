import React from 'react';
import Monitoring from './Monitoring';

// This component is now a wrapper around Monitoring with a default view,
// keeping the architecture clean and centralized.
const ReceivedNotifications: React.FC = () => {
  return (
    <div className="w-full">
        {/* We redirect to Monitoring component which handles both tabs logic now */}
        <Monitoring notifications={[]} />
    </div>
  );
};

export default ReceivedNotifications;