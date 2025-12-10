import React from 'react';
import Monitoring from './Monitoring';

const ReceivedNotifications: React.FC = () => {
  return (
    <div className="w-full">
        {/* Passamos defaultTab="received" para garantir que a aba correta seja exibida inicialmente */}
        <Monitoring notifications={[]} defaultTab="received" />
    </div>
  );
};

export default ReceivedNotifications;