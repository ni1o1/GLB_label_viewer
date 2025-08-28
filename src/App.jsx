import React from 'react';
import { Layout } from 'antd';
import { AnnotationProvider } from './store/annotationStore.jsx';
import MainLayout from './components/Layout';
import './App.css';

function App() {
  return (
    <AnnotationProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <MainLayout />
      </Layout>
    </AnnotationProvider>
  );
}

export default App
