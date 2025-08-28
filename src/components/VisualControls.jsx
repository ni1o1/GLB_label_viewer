import React, { useCallback, useRef } from 'react';
import { Card, Slider, Switch, Button, Typography, ColorPicker, Row, Col, Collapse, Radio } from 'antd';
import { BgColorsOutlined, UndoOutlined, RotateRightOutlined } from '@ant-design/icons';
import { useAnnotation } from '../store/annotationStore';

const { Text } = Typography;

const VisualControls = () => {
  const { state, dispatch } = useAnnotation();
  const { pointSize, viewMode, shadingMode, backgroundColor, colorAdjustment, orientationMode, transformMode, meshOpacity, hasMesh, showGridAndAxes, showWireframe } = state;
  const debounceTimers = useRef({});

  // Debounce function
  const debounce = useCallback((key, func, delay = 100) => {
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(func, delay);
  }, []);

  // --- Handlers ---
  const handleColorReset = () => {
    dispatch({
      type: 'SET_COLOR_ADJUSTMENT',
      payload: { brightness: 1.0, contrast: 1.0, saturation: 1.0, gamma: 1.0 },
    });
  };
  const handleViewModeChange = (e) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: e.target.value });
  };

  const handleOrientationModeChange = (checked) => {
    dispatch({ type: 'SET_ORIENTATION_MODE', payload: checked });
  };
  const handleTransformModeChange = (e) => {
    dispatch({ type: 'SET_TRANSFORM_MODE', payload: e.target.value });
  };
  const handleBackgroundColorChange = (color) => {
    dispatch({ type: 'SET_BACKGROUND_COLOR', payload: color.toHexString() });
  };
  const handleGridAndAxesToggle = (checked) => {
    dispatch({ type: 'TOGGLE_GRID_AND_AXES_VISIBILITY' });
  };
  const handleWireframeToggle = (checked) => {
    dispatch({ type: 'TOGGLE_WIREFRAME' });
  };

  // --- Reusable Slider Component with Debounce ---
  const AdjustmentSlider = ({ title, value, onChange, min, max, step }) => {
    const handleChange = useCallback((v) => {
      debounce(`${title}-slider`, () => onChange(v), 100);
    }, [title, onChange, debounce]);

    return (
      <div>
        <Text type="secondary" style={{ fontSize: '12px' }}>{title}</Text>
        <Slider
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          tooltip={{ formatter: (v) => v.toFixed(1) }}
        />
      </div>
    );
  };

  return (
    <Card title="Visual Settings" variant="borderless"  size="small">
      <Row gutter={[16, 16]} align="middle">
        {/* Only show point size option for non-mesh files */}
        {!hasMesh && (
          <>
            <Col span={6}><Text type="secondary">Point Size</Text></Col>
            <Col span={18}>
              <Slider
                min={0.1} max={10} step={0.1}
                value={pointSize}
                onChange={(value) => dispatch({ type: 'SET_POINT_SIZE', payload: value })}
                style={{ margin: 0 }}
              />
            </Col>
          </>
        )}

        <Col span={12}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text type="secondary">View Mode</Text>
            <Radio.Group
              value={viewMode}
              onChange={handleViewModeChange}
              size="small"
              buttonStyle="solid"
            >
              <Radio.Button value="default">Original</Radio.Button>
              <Radio.Button value="labels">Labels</Radio.Button>
            </Radio.Group>
          </div>
        </Col>


        {hasMesh && (
           <>
             <Col span={6}><Text type="secondary">Face Opacity</Text></Col>
             <Col span={6}>
               <Slider
                 min={0} max={1} step={0.1}
                 value={meshOpacity || 1.0}
                 onChange={(value) => dispatch({ type: 'SET_MESH_OPACITY', payload: value })}
                 style={{ margin: 0 }}
                 tooltip={{ formatter: (v) => `${(v * 100).toFixed(0)}%` }}
               />
             </Col>
           </>
         )}

        <Col span={12}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text type="secondary">Background Color</Text>
            <ColorPicker
              value={backgroundColor}
              onChangeComplete={handleBackgroundColorChange}
              size="small"
            />
          </div>
        </Col>
        <Col span={12}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text type="secondary">
              <RotateRightOutlined /> Orientation Adjustment
            </Text>
            <Switch
              checked={orientationMode}
              onChange={handleOrientationModeChange}
              size="small"
            />
          </div>
        </Col>
        <Col span={12}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text type="secondary">Show Grid and Axes</Text>
            <Switch
              checked={showGridAndAxes}
              onChange={handleGridAndAxesToggle}
              size="small"
            />
          </div>
        </Col>
        {hasMesh && (
          <Col span={12}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text type="secondary">Show Wireframe</Text>
              <Switch
                checked={showWireframe}
                onChange={handleWireframeToggle}
                size="small"
              />
            </div>
          </Col>
        )}
        {orientationMode && (
          <Col span={24}>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px', marginBottom: 4, display: 'block' }}>Transform Mode</Text>
              <Radio.Group
                value={transformMode}
                onChange={handleTransformModeChange}
                size="small"
                buttonStyle="solid"
              >
                <Radio.Button value="rotate">Rotate (E)</Radio.Button>
                <Radio.Button value="translate">Move (W)</Radio.Button>
              </Radio.Group>
            </div>
          </Col>
        )}
      </Row>
      
    </Card>
  );
};

export default VisualControls;