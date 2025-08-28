import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Typography } from 'antd';
import { UpOutlined, DownOutlined } from '@ant-design/icons';
import PLYViewer from './PLYViewer';
import Sidebar from './Sidebar';

const { Title } = Typography;

const MainLayout = () => {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  
  // 1. Add state to manage panel position and drag status
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  
  // Use useRef to store mouse offset during drag to avoid unnecessary re-renders
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef(null); // Reference to panel element

  // 2. Handle mouse down event
  const handleMouseDown = useCallback((e) => {
    // Check if clicked element is a button, if so, don't trigger drag
    if (e.target.closest('button')) {
      return;
    }
    
    setIsDragging(true);
    // Calculate mouse click position offset relative to panel top-left corner
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  }, [position]);

  // 3. Handle mouse move event
  const handleMouseMove = useCallback((e) => {
    // If not dragging, don't perform any action
    if (!isDragging) return;

    // Calculate new panel position
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    
    setPosition({ x: newX, y: newY });
    e.preventDefault();
  }, [isDragging]);
  
  // 4. Handle mouse up event
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 5. Use useEffect to manage global event listeners
  useEffect(() => {
    // Only add listeners to window when dragging
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    // Cleanup function: remove listeners when component unmounts or drag ends
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);


  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 全屏PLY展示界面 */}
      <div style={{ width: '100%', height: '100%' }}>
        <PLYViewer />
      </div>
      
      {/* 悬浮的标注工具栏 */}
      <div 
        ref={panelRef}
        className="floating-panel" 
        style={{ 
          position: 'absolute', 
          // 使用状态化的位置
          top: `${position.y}px`, 
          left: `${position.x}px`,
          width: isPanelCollapsed ? '200px' : '520px', 
          maxHeight: isPanelCollapsed ? '60px' : 'calc(100vh - 40px)',
          background: '#fffffff2', 
          backdropFilter: 'blur(10px)', 
          borderRadius: '8px', 
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)', 
          zIndex: 1000, 
          transition: isDragging ? 'none' : 'all 0.3s ease-in-out', // Don't apply transition during drag
          overflow: 'hidden',
          display: 'flex', 
          flexDirection: 'column',
          userSelect: isDragging ? 'none' : 'auto' // Disable text selection during drag
        }} 
      >
        {/* 标题和控制按钮 */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '8px 16px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            cursor: 'move', // Add drag cursor
          }}
          // 在标题栏上启动拖动
          onMouseDown={handleMouseDown}
        >
          <Title level={4} style={{ margin: 0 }}>
            3D Label Viewer
          </Title>
          <div>
            <Button
              type="text"
              icon={isPanelCollapsed ? <DownOutlined /> : <UpOutlined />}
              onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
              style={{
                border: 'none',
                boxShadow: 'none',
                marginRight: '8px',
                cursor: 'pointer', // 确保按钮有正确的指针样式
              }}
            />
          </div>
        </div>
        
        {/* 侧边栏内容 */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto',
          display:  isPanelCollapsed ? 'none' : 'block'
        }}>
          <Sidebar />
        </div>
        
      </div>
    </div>
  );
};

export default MainLayout;