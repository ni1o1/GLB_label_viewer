import React, { useState, useCallback } from 'react';
// 1. Ensure useCallback is imported from React
import { Card, Button, List, Modal, Input, Form, Space, Tag, Popover, Typography, message } from 'antd'; 
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { HexColorPicker } from 'react-colorful';
import { useAnnotation } from '../store/annotationStore';
import { DEFAULT_LABEL_COLORS, getDefaultColorByIndex } from '../constants/colors';

const { Text } = Typography;

// A standalone, pure color selector Popover component
const ColorPickerPopover = ({ value, onChange }) => (
  <Space align="center">
    <Popover
      content={<HexColorPicker color={value || '#ff6b6b'} onChange={onChange} />}
      trigger="click"
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: 4,
          backgroundColor: value || '#ff6b6b', cursor: 'pointer',
          border: '1px solid rgba(0, 0, 0, 0.1)'
        }}
      />
    </Popover>
    <Text type="secondary" style={{ fontSize: '12px' }}>
      Click color swatch to select color
    </Text>
  </Space>
);

// --- Optimization 2: Extract label statistics text generation logic as helper function ---
  // This makes JSX in renderItem clearer and more readable.
const getLabelStatsText = (label, labelInfo) => {
  const pointCount = labelInfo?.labelStats?.[label.id] || 0;
  const faceCount = labelInfo?.faceLabelStats?.[label.id] || 0;
  const total = pointCount + faceCount;
  return `ID: ${label.id} (${total} points/faces)`;
};


const LabelManager = () => {
  const { state, dispatch } = useAnnotation();
  const { labels, activeLabel, labelInfo } = state;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null);
  
  const [form] = Form.useForm();

  // --- Optimization 3: Wrap event handlers with useCallback ---
  // useCallback returns a memoized version of the function that only updates when dependencies change.
  // This helps avoid unnecessary re-renders in child components.

  const showModal = useCallback((label = null) => {
    if (label) {
      setEditingLabel(label);
      form.setFieldsValue(label);
    } else {
      setEditingLabel(null);
      const nextId = labels.length > 0 ? Math.max(...labels.map(l => l.id)) + 1 : 1;
      const defaultColor = getDefaultColorByIndex(labels.length);
      
      form.resetFields();
      form.setFieldsValue({
        id: nextId,
        name: `Label ${nextId}`,
        color: defaultColor
      });
    }
    setIsModalVisible(true);
    dispatch({ type: 'SET_MODAL_OPEN', payload: true }); // Notify store Modal is open
  }, [form, labels, dispatch]); // dependencies are form, labels and dispatch

  const handleOk = useCallback(() => {
    form.validateFields()
      .then(values => {
        const id = parseInt(values.id);

        if (editingLabel) {
          dispatch({
            type: 'UPDATE_LABEL',
            payload: { ...editingLabel, ...values, id }
          });
        } else {
          if (labels.some(l => l.id === id)) {
            // --- Optimization 4: Simplify and localize message prompts ---
            message.error(`Label with ID ${id} already exists.`);
            return;
          }
          dispatch({
            type: 'ADD_LABEL',
            payload: { ...values, id, visible: true }
          });
        }
        setIsModalVisible(false);
        dispatch({ type: 'SET_MODAL_OPEN', payload: false }); // Notify store Modal is closed
      })
      .catch(info => {
        console.log('Form validation failed:', info);
      });
  }, [form, editingLabel, labels, dispatch]); // dependencies are form, editingLabel, labels and dispatch

  const handleCancel = useCallback(() => {
    setIsModalVisible(false);
    setEditingLabel(null);
    form.resetFields();
    dispatch({ type: 'SET_MODAL_OPEN', payload: false }); // Notify store Modal is closed
  }, [form, dispatch]); // dependencies are form and dispatch

  const handleDelete = useCallback((labelId) => {
    dispatch({ type: 'DELETE_LABEL', payload: labelId });
    if (activeLabel === labelId) {
      dispatch({ type: 'SET_ACTIVE_LABEL', payload: null });
    }
  }, [dispatch, activeLabel]); // dependencies are dispatch and activeLabel

  const toggleVisibility = useCallback((label) => {
    dispatch({ type: 'UPDATE_LABEL', payload: { ...label, visible: !label.visible } });
  }, [dispatch]); // dependencies are dispatch

  return (
    <>
      <Card
        title="Label Management"
        size="small"
        variant="borderless" // Alternative to bordered={false}, using new variant property
      >
        <List
          size="small"
          itemLayout="horizontal"
          dataSource={labels}
          renderItem={(label) => (
            // --- Optimization 5: Add required key property for list items ---
            <List.Item
              key={label.id}
              actions={[
                <Button
                  type="text"
                  icon={label.visible ? <EyeOutlined /> : <EyeInvisibleOutlined style={{color: '#aaa'}} />}
                  onClick={() => toggleVisibility(label)}
                  size="small"
                  aria-label={label.visible ? 'Hide label' : 'Show label'} // Improve accessibility
                />,
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => showModal(label)}
                  size="small"
                  aria-label="Edit label"
                />,
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(label.id)}
                  size="small"
                  aria-label="Delete label"
                />,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      width: 20, height: 20,
                      backgroundColor: label.color,
                      borderRadius: 4,
                      border: '1px solid #ddd'
                    }}
                  />
                }
                title={<Text style={{ opacity: label.visible ? 1 : 0.5 }}>{label.name}</Text>}
                description={
                  <Text type="secondary" style={{ opacity: label.visible ? 1 : 0.5 }}>
                    {getLabelStatsText(label, labelInfo)}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={editingLabel ? 'Edit Label' : 'Add New Label'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        okText={editingLabel ? 'Update' : 'Add'}
        destroyOnHidden // Alternative to destroyOnClose, destroy Modal content after hiding to ensure form state reset
      >
        <Form form={form} layout="vertical" name="labelForm">
          <Form.Item
            name="name"
            label="Label Name"
            rules={[{ required: true, message: 'Please enter label name' }]}
          >
            <Input placeholder="e.g., car, pedestrian" />
          </Form.Item>
          <Form.Item
            name="id"
            label="Label ID"
            rules={[{ required: true, message: 'Please enter unique label ID' }]}
          >
            <Input placeholder="e.g., 1, 2, 3..." type="number" disabled={!!editingLabel} />
          </Form.Item>
          <Form.Item
            name="color"
            label="Label Color"
            // `Form.Item` will automatically pass value and onChange to child components
          >
            <ColorPickerPopover />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default LabelManager;