import React, { useState, useCallback } from 'react';
// 1. 确保从 React 中导入 useCallback
import { Card, Button, List, Modal, Input, Form, Space, Tag, Popover, Typography, message } from 'antd'; 
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { HexColorPicker } from 'react-colorful';
import { useAnnotation } from '../store/annotationStore';
import { DEFAULT_LABEL_COLORS, getDefaultColorByIndex, getSemanticColorForLabel } from '../constants/colors';

const { Text } = Typography;

// 一个独立的、纯粹的颜色选择器Popover组件
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
      Click the color block to select color
    </Text>
  </Space>
);

// --- 优化 2: 将标签统计文本的生成逻辑提取为辅助函数 ---
// 这使得 renderItem 中的 JSX 更加清晰易读。
const getLabelStatsText = (label, labelInfo) => {
  const pointCount = labelInfo?.labelStats?.[label.id] || 0;
  const faceCount = labelInfo?.faceLabelStats?.[label.id] || 0;
  const total = pointCount + faceCount;
  return `ID: ${label.id} (${total} faces)`;
};


const LabelManager = () => {
  const { state, dispatch } = useAnnotation();
  const { labels, activeLabel, labelInfo } = state;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null);
  
  const [form] = Form.useForm();

  // --- 优化 3: 使用 useCallback 封装事件处理器 ---
  // useCallback 会返回一个 memoized 版本的函数，仅在依赖项改变时才会更新。
  // 这有助于避免在子组件中进行不必要的重新渲染。

  const showModal = useCallback((label = null) => {
    if (label) {
      setEditingLabel(label);
      form.setFieldsValue(label);
    } else {
      setEditingLabel(null);
      const nextId = labels.length > 0 ? Math.max(...labels.map(l => l.id)) + 1 : 1;
      const labelName = `标签 ${nextId}`;
      
      // 优先使用语义颜色，如果没有匹配的语义颜色则使用默认颜色
      const semanticColor = getSemanticColorForLabel(labelName, labels.length);
      
      form.resetFields();
      form.setFieldsValue({
        id: nextId,
        name: labelName,
        color: semanticColor
      });
    }
    setIsModalVisible(true);
    dispatch({ type: 'SET_MODAL_OPEN', payload: true }); // 通知store Modal已打开
  }, [form, labels, dispatch]); // 依赖项是 form, labels 和 dispatch

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
            // --- 优化 4: 简化并汉化 message 提示 ---
            message.error(`ID为 ${id} 的标签已存在。`);
            return;
          }
          dispatch({
            type: 'ADD_LABEL',
            payload: { ...values, id, visible: true }
          });
        }
        setIsModalVisible(false);
        dispatch({ type: 'SET_MODAL_OPEN', payload: false }); // 通知store Modal已关闭
      })
      .catch(info => {
        console.log('表单验证失败:', info);
      });
  }, [form, editingLabel, labels, dispatch]); // 依赖项是 form, editingLabel, labels 和 dispatch

  const handleCancel = useCallback(() => {
    setIsModalVisible(false);
    setEditingLabel(null);
    form.resetFields();
    dispatch({ type: 'SET_MODAL_OPEN', payload: false }); // 通知store Modal已关闭
  }, [form, dispatch]); // 无依赖项

  const handleDelete = useCallback((labelId) => {
    dispatch({ type: 'DELETE_LABEL', payload: labelId });
    if (activeLabel === labelId) {
      dispatch({ type: 'SET_ACTIVE_LABEL', payload: null });
    }
  }, [dispatch, activeLabel]); // 依赖项是 dispatch 和 activeLabel

  const toggleVisibility = useCallback((label) => {
    dispatch({ type: 'UPDATE_LABEL', payload: { ...label, visible: !label.visible } });
  }, [dispatch]); // 依赖项是 dispatch

  // 监听标签名称变化，自动应用语义颜色
  const handleNameChange = useCallback((e) => {
    const labelName = e.target.value;
    if (labelName && !editingLabel) { // 只在创建新标签时自动应用语义颜色
      const semanticColor = getSemanticColorForLabel(labelName, labels.length);
      form.setFieldsValue({ color: semanticColor });
    }
  }, [form, editingLabel, labels.length]); // 依赖项是 form, editingLabel 和 labels.length

  return (
    <>
      <Card
        title="Labels"
        size="small"
        variant="borderless" // 替代 bordered={false}，使用新的 variant 属性
      >
        <List
          size="small"
          itemLayout="horizontal"
          dataSource={labels}
          renderItem={(label) => (
            // --- 优化 5: 为列表项添加必须的 key 属性 ---
            <List.Item
              key={label.id}
              actions={[
                <Button
                  type="text"
                  icon={label.visible ? <EyeOutlined /> : <EyeInvisibleOutlined style={{color: '#aaa'}} />}
                  onClick={() => toggleVisibility(label)}
                  size="small"
                  aria-label={label.visible ? 'Hide label' : 'Show label'} // 增加可访问性
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
        title={editingLabel ? 'Edit label' : 'Add new label'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        okText={editingLabel ? 'Update' : 'Add'}
        destroyOnHidden // 替代 destroyOnClose，在隐藏后销毁 Modal 内容，确保表单状态重置
      >
        <Form form={form} layout="vertical" name="labelForm">
          <Form.Item
            name="name"
            label="Label name"
            rules={[{ required: true, message: 'Please input label name' }]}
          >
            <Input 
              placeholder="water, tree, building" 
              onChange={handleNameChange}
            />
          </Form.Item>
          <Form.Item
            name="id"
            label="Label ID"
            rules={[{ required: true, message: 'Please input unique label ID' }]}
          >
            <Input placeholder="For example: 1, 2, 3..." type="number" disabled={!!editingLabel} />
          </Form.Item>
          <Form.Item
            name="color"
            label="Label color"
            // `Form.Item` 会自动将 value 和 onChange 传递给子组件
          >
            <ColorPickerPopover />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default LabelManager;