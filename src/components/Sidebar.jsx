
import { Space } from 'antd';
import LabelManager from './LabelManager';
import VisualControls from './VisualControls';
import DataOverview from './DataOverview';

const Sidebar = () => {
  return (
    <div style={{ padding: '0px 16px', height: '100%', overflow: 'auto' }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        
          <DataOverview />

          <VisualControls />
          <LabelManager />
      </Space>
    </div>
  );
};

export default Sidebar;