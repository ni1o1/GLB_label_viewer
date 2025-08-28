import React from 'react';
import { useMemo } from 'react';
import { Card, Button, Typography, Row, Col, Tabs, Descriptions, Tag } from 'antd';
// 1. Removed unnecessary Statistic and List components as we use more compact implementation
import { ExportOutlined, FileTextOutlined, DatabaseOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { exportPLY } from '../utils/plyExporter';
import { exportGLB, validateExportData } from '../utils/glbExporter';
import { useAnnotation } from '../store/annotationStore';

const { Text, Title } = Typography;

// 2. [New] Create a more compact custom statistics component for easy reuse
const CompactStatistic = ({ title, value, valueStyle }) => (
  <div>
    <Text type="secondary" style={{ fontSize: '12px' }}>{title}</Text>
    <Title level={5} style={{ marginTop: '2px', marginBottom: 0, ...valueStyle }}>
      {value}
    </Title>
  </div>
);


const DataOverview = () => {
  const { state } = useAnnotation();
  
  // Defensive check: ensure core state exists to prevent runtime crashes
  if (!state || !state.points || !state.labels) {
    return (
      <Card title="Data Overview" variant="outlined" size="small">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Text type="secondary">Loading data...</Text>
        </div>
      </Card>
    );
  }
  
  const { points, labels, fileName, fileHeader, labelInfo, selectedPoints, hasMesh, faces, selectedFaces, materials, textureFile, originalScene, interactionMapping } = state;

  // --- Data Calculation (无改动) ---
  const handleExport = () => {
    if (points.length === 0) return;
    // Pass original header info to preserve original attribute structure
    const originalHeader = fileHeader || null;
    exportPLY(points, fileName, hasMesh ? faces : null, materials, textureFile, labels, originalHeader);
  };

  const handleGLBExport = async () => {
    if (points.length === 0) return;
    
    // Validate if original scene object and interaction mapping exist
    if (!originalScene) {
      console.error('GLB export failed: missing original scene object. Please ensure GLB/GLTF file is loaded.');
      return;
    }
    
    if (!interactionMapping) {
      console.error('GLB export failed: missing interaction mapping object. Please ensure correct parser is used.');
      return;
    }
    
    try {
      // Validate export data
      const validation = validateExportData(points, faces, labels);
      if (!validation.valid) {
        console.error('导出数据验证失败:', validation.errors);
        return;
      }
      
      if (validation.warnings.length > 0) {
        console.warn('导出数据警告:', validation.warnings);
      }
      
      // Execute GLB export (new architecture: precise mapping based on interactionMapping)
      const originalHeader = fileHeader || null;
      await exportGLB(originalScene, interactionMapping, points, fileName, hasMesh ? faces : null, labels, originalHeader);
      console.log('GLB export completed (new architecture: precise mapping based on interactionMapping)');
    } catch (error) {
      console.error('GLB export failed:', error);
    }
  };

  const labeledPoints = labelInfo ? labelInfo.labeledCount : points.filter(point => point.labelId !== undefined && point.labelId !== null).length;
  const unlabeledPoints = labelInfo ? labelInfo.unlabeledCount : points.length - labeledPoints;
  
  const labeledFaces = hasMesh && faces ? faces.filter(face => face.labelId !== undefined && face.labelId !== null && face.labelId !== 0 && face.labelId !== -1).length : 0;
  const unlabeledFaces = hasMesh && faces ? faces.length - labeledFaces : 0;
  
  const activeLabelsCount = labels.filter(label => label.visible !== false).length;
  const existingLabelStats = (labelInfo && labelInfo.labelStats) ? labelInfo.labelStats : {};
  const existingFaceLabelStats = (labelInfo && labelInfo.faceLabelStats) ? labelInfo.faceLabelStats : {};

  const bounds = useMemo(() => {
    if (points.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const [x, y, z] = points[i].position;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    return {
      width: (maxX - minX).toFixed(2),
      height: (maxY - minY).toFixed(2),
      depth: (maxZ - minZ).toFixed(2),
    };
  }, [points]);

  // Determine file type
  const isGLBFile = fileName && (fileName.toLowerCase().endsWith('.glb') || fileName.toLowerCase().endsWith('.gltf'));
  const isPLYFile = fileName && fileName.toLowerCase().endsWith('.ply');

  // --- UI Components for Tabs ---

  // 3. [Refactor] Overview Tab: Removed internal Card, unified layout to make it more compact
  const OverviewTab = (
    <div>
      <Row gutter={[24, 20]}>
        {/* Point Cloud Statistics */}
        {!hasMesh && (<Col span={24}>
          <Row gutter={[16, 16]}>
            <Col span={12}><CompactStatistic title="Total Points" value={points.length} /></Col>
            <Col span={12}><CompactStatistic title="Selected" value={selectedPoints.length} valueStyle={{ color: '#1890ff' }} /></Col>
            <Col span={12}><CompactStatistic title="Labeled" value={labeledPoints} valueStyle={{ color: '#52c41a' }} /></Col>
            <Col span={12}><CompactStatistic title="Unlabeled" value={unlabeledPoints} valueStyle={{ color: '#ff4d4f' }} /></Col>
          </Row>
        </Col>)}
        
        {/* Face Statistics */}
        {hasMesh && (
          <Col span={24}>
            <Row gutter={[16, 16]}>
              <Col span={8}><CompactStatistic title="Total Faces" value={faces ? faces.length : 0} /></Col>
              <Col span={8}><CompactStatistic title="Labeled" value={labeledFaces} valueStyle={{ color: '#52c41a' }} /></Col>
              <Col span={8}><CompactStatistic title="Unlabeled" value={unlabeledFaces} valueStyle={{ color: '#ff4d4f' }} /></Col>
            </Row>
          </Col>
        )}
      </Row>
    </div>
  );

  // 5. [Refactor] Details Tab: Adjusted Descriptions styling and displayed label statistics in more compact way
  const DetailsTab = (
    <Descriptions bordered size="small" column={1} style={{ marginTop: '12px' }} styles={{ label: { width: '110px' } }}>
      {/* File Information */}
      <Descriptions.Item label="File Name">{fileName || 'N/A'}</Descriptions.Item>
      {fileHeader && (
        <>
          <Descriptions.Item label="PLY Format">{`${fileHeader.format} ${fileHeader.version}`}</Descriptions.Item>
          <Descriptions.Item label="PLY Vertex Count">{fileHeader.vertexCount}</Descriptions.Item>
          {fileHeader.comments.length > 0 && (
            <Descriptions.Item label="PLY Comments">{fileHeader.comments.join(', ')}</Descriptions.Item>
          )}
        </>
      )}
      {fileHeader?.properties && (
        <Descriptions.Item label="Available Fields">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {fileHeader.properties.map(p => <Tag key={p.name}>{p.name}</Tag>)}
          </div>
        </Descriptions.Item>
      )}
      {bounds && (
        <Descriptions.Item label="Point Cloud Size (W×D×H)">
          {`${bounds.width} × ${bounds.depth} × ${bounds.height}`}
        </Descriptions.Item>
      )}

      {/* Label Statistics */}
      <Descriptions.Item label="Active Labels">{`${activeLabelsCount} / ${labels.length}`}</Descriptions.Item>
      {existingLabelStats && Object.keys(existingLabelStats).length > 0 && (
        <Descriptions.Item label="Point Label Statistics">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(existingLabelStats).map(([label, count]) => (
              <Text key={label} style={{ fontSize: '12px' }}>
                <Tag color="blue">{`Label ${label}`}</Tag> 
                {`${count} points`}
              </Text>
            ))}
          </div>
        </Descriptions.Item>
      )}
      {existingFaceLabelStats && Object.keys(existingFaceLabelStats).length > 0 && (
        <Descriptions.Item label="Face Label Statistics">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(existingFaceLabelStats).map(([label, count]) => (
              <Text key={label} style={{ fontSize: '12px' }}>
                <Tag color="green">{`Label ${label}`}</Tag> 
                {`${count} faces`}
              </Text>
            ))}
          </div>
        </Descriptions.Item>
      )}
    </Descriptions>
  );


  return (
    <Card title="Data Overview" variant="borderless" size="small" styles={{ body: { padding: '0 12px 12px' } }}>
      <Tabs 
        defaultActiveKey="1" 
        size="small"
        items={[
          {
            key: '1',
            label: <span><DatabaseOutlined />Overview</span>,
            children: OverviewTab
          },
          {
            key: '2', 
            label: <span><FileTextOutlined />Details</span>,
            children: DetailsTab
          }
        ]}
      />
    </Card>
  );
};

export default DataOverview;