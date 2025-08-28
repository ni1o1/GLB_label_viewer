import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAnnotation } from '../store/annotationStore';
import { parsePLY } from '../utils/plyParser';
import { parseGLB, isGLBFile, isGLTFFile } from '../utils/glbParser';
import { message } from 'antd';
import JSZip from 'jszip';
import { getDefaultColorByIndex } from '../constants/colors';

const FileUploadOverlay = () => {
  const { state, dispatch } = useAnnotation();
  const { points } = state;

  /**
   * Core processing function: parse 3D file data, update state, and display messages
   * @param {ArrayBuffer} fileContent - ArrayBuffer content of 3D file
   * @param {string} fileName - Name of the file
   * @param {Map<string, ArrayBuffer|string>} materialMap - Mapping of material files
   * @param {string} sourceName - Data source name (e.g., a.zip or b.ply)
   */
  const processAndLoad3DFile = useCallback(async (fileContent, fileName, materialMap, sourceName) => {
    try {
      let fileData;
      
      // Choose appropriate parser based on file type
      if (isGLBFile(fileName) || isGLTFFile(fileName)) {
        fileData = await parseGLB(fileContent, fileName);
      } else {
        // Default to PLY parser
        fileData = parsePLY(fileContent, materialMap);
      }

      // 1. Update file data and name to global state
      dispatch({ type: 'LOAD_FILE_DATA', payload: fileData });
      dispatch({ type: 'SET_FILE_NAME', payload: fileName });

      // 2. Automatically create labels based on file information
      const { labelInfo, labelDefinitions } = fileData;
      if (labelInfo || labelDefinitions) {
        const existingLabelIds = new Set();
        let colorIndex = 0; // Used for assigning colors in sequence
        
        // First process labels explicitly defined in header
        if (labelDefinitions && Array.isArray(labelDefinitions)) {
          
          // 1. Sort object array based on actual label.id
          const sortedLabels = labelDefinitions.sort((a, b) => a.id - b.id);

          // 2. Iterate through each label object in array
          sortedLabels.forEach(label => {
            // 3. Get actual id and name from label object
            const id = label.id;
            const name = label.name || `Label ${id}`; // Provide default if no name

            if (id > 0) { // Ignore special IDs like 0 (unlabeled) and -1 (uncategorized)
              dispatch({
                type: 'ADD_LABEL',
                payload: {
                  id: id,
                  name: name,
                  // 4. Prioritize colors from file, otherwise assign in sequence
                  color: label.color || getDefaultColorByIndex(colorIndex),
                  visible: label.visible !== undefined ? label.visible : true
                }
              });
              existingLabelIds.add(id);
              colorIndex++;
            }
          });
        }
        
        // Then process labels that exist in data but are not defined in header
        if (labelInfo) {
            const pointLabelKeys = labelInfo.labelStats ? Object.keys(labelInfo.labelStats) : [];
            const faceLabelKeys = labelInfo.faceLabelStats ? Object.keys(labelInfo.faceLabelStats) : [];
            const allLabelIdsInData = new Set([...pointLabelKeys, ...faceLabelKeys]);
            
            // Sort by label ID to ensure consistent color assignment
            const sortedLabelIds = Array.from(allLabelIdsInData).sort((a, b) => parseInt(a) - parseInt(b));

            sortedLabelIds.forEach(labelIdStr => {
                const id = parseInt(labelIdStr, 10);
                if (!isNaN(id) && id > 0 && !existingLabelIds.has(id)) {
                    dispatch({
                        type: 'ADD_LABEL',
                        payload: { id, name: `Label ${id}`, color: getDefaultColorByIndex(colorIndex), visible: true }
                    });
                    colorIndex++;
                }
            });
        }
      }

      // 3. Build and display success summary
      let successMessage = `Successfully loaded ${fileData.points.length} points from ${sourceName}`;
      if (fileData.faces?.length > 0) {
        successMessage += ` and ${fileData.faces.length} faces`;
      }
      if (materialMap.size > 0) {
        successMessage += `, and linked ${materialMap.size} material files`;
      }
      message.success(successMessage);

      if (labelInfo?.labeledCount > 0) {
        const uniqueLabelCount = Object.keys(labelInfo.labelStats).filter(id => id !== '0').length;
        message.info(`File contains ${labelInfo.labeledCount} pre-labeled points, with ${uniqueLabelCount} label types`);
      }

    } catch (error) {
      console.error('Error processing 3D file:', error);
      message.error('Failed to parse 3D file, please check file format or content.');
    }
  }, [dispatch]);

  /**
   * Process files from zip package
   */
  const handleCompressedFiles = useCallback(async (zipFile) => {
    message.loading({ content: `Extracting and processing ${zipFile.name}...`, key: 'processing' });
    
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipFile);
      
      const modelFiles = [];
      const materialMap = new Map();

      for (const [filename, file] of Object.entries(zipContent.files)) {
        if (file.dir) continue;

        const lowerName = filename.toLowerCase();
        if (lowerName.endsWith('.ply') || lowerName.endsWith('.glb') || lowerName.endsWith('.gltf')) {
          const content = await file.async('arraybuffer');
          modelFiles.push({ name: filename, content });
        } else if (/\.(jpg|jpeg|png|bmp|tga|mtl)$/i.test(lowerName)) {
           const content = await file.async(lowerName.endsWith('.mtl') ? 'string' : 'arraybuffer');
           materialMap.set(filename, content);
        }
      }

      if (modelFiles.length === 0) {
        throw new message.error('No supported 3D files found in zip package (PLY, GLB, GLTF)');
      }
      if (modelFiles.length > 1) {
        message.warning(`Detected ${modelFiles.length} 3D files, will use the first: ${modelFiles[0].name}`);
      }
      
      const mainFile = modelFiles[0];
      await processAndLoad3DFile(mainFile.content, mainFile.name, materialMap, zipFile.name);

    } catch (error) {
      console.error('Error processing compressed file:', error);
      message.error(error.message || 'Failed to extract or process file, please check zip package.');
    } finally {
      message.destroy('processing');
    }
  }, [processAndLoad3DFile]);

  /**
   * Process individual files dropped directly
   */
  const handleIndividualFiles = useCallback(async (files) => {
    message.loading({ content: 'Reading file...', key: 'processing' });

    const modelFiles = files.filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.ply') || name.endsWith('.glb') || name.endsWith('.gltf');
    });
    const materialFiles = files.filter(f => /\.(jpg|jpeg|png|bmp|tga|mtl)$/i.test(f.name));

    if (modelFiles.length === 0) {
        message.error('No supported 3D file found, please select PLY, GLB, or GLTF file.');
        message.destroy('processing');
        return;
    }
     if (modelFiles.length > 1) {
        message.warning(`Detected ${modelFiles.length} 3D files, will use the first: ${modelFiles[0].name}`);
    }

    const mainModelFile = modelFiles[0];
    const materialMap = new Map();

    try {
        // Use Promise.all to read all material files in parallel
        await Promise.all(materialFiles.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const isMtl = file.name.toLowerCase().endsWith('.mtl');
                    // MTL files need text content, image files need ArrayBuffer
                    const result = isMtl ? new TextDecoder().decode(reader.result) : reader.result;
                    materialMap.set(file.name, result);
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        }));

        // Read main 3D file
        const fileContent = await mainModelFile.arrayBuffer();

        // Call core processing function
        await processAndLoad3DFile(fileContent, mainModelFile.name, materialMap, mainModelFile.name);

    } catch(error) {
        console.error("Failed to read file:", error);
        message.error("Error occurred while reading file.");
    } finally {
        message.destroy('processing');
    }

  }, [processAndLoad3DFile]);

  /**
   * Dropzone's onDrop callback
   */
  const onDrop = useCallback((acceptedFiles) => {
    if (!acceptedFiles?.length) return;

    const compressedFiles = acceptedFiles.filter(f => /\.(zip|rar|7z)$/i.test(f.name));

    if (compressedFiles.length > 0) {
      if (compressedFiles.length > 1) {
        message.warning('Multiple zip files detected, will only process the first one.');
      }
      // JSZip doesn't natively support rar and 7z, assuming users mainly use zip or have other libraries
      if(!compressedFiles[0].name.toLowerCase().endsWith('.zip')) {
        message.error('Sorry, currently only .zip format is supported for compressed packages.');
        return;
      }
      handleCompressedFiles(compressedFiles[0]);
    } else {
      handleIndividualFiles(acceptedFiles);
    }
  }, [handleCompressedFiles, handleIndividualFiles]);


  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.ply', '.mtl'],
      'application/octet-stream': ['.ply', '.glb'],
      'model/gltf-binary': ['.glb'],
      'model/gltf+json': ['.gltf'],
      'application/json': ['.gltf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/bmp': ['.bmp'],
      'image/targa': ['.tga'],
      'application/zip': ['.zip'],
      // RAR and 7Z are harder to handle client-side without extra libraries
      // 'application/x-rar-compressed': ['.rar'],
      // 'application/x-7z-compressed': ['.7z'],
    },
    multiple: true,
    disabled: points.length > 0,
  });

  // 如果已经加载了点云数据，则不再显示上传区域
  if (points.length > 0) {
    return null;
  }

  return (
    <div
      {...getRootProps()}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isDragActive ? 'rgba(0, 100, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        border: isDragActive ? '3px dashed #1890ff' : '3px dashed #d9d9d9',
        borderRadius: '8px', margin: '20px', cursor: 'pointer',
        transition: 'all 0.3s ease', zIndex: 10,
      }}
    >
      <input {...getInputProps()} />
      <div style={{ textAlign: 'center', color: '#666' }}>
        <h2 style={{ marginBottom: '10px' }}>
          {isDragActive ? 'Drop files to start' : 'Drag files here'}
        </h2>
        <p>or click to select files</p>
        <p style={{ fontSize: '14px', marginTop: '10px' }}>
          Supported formats: PLY, GLB, GLTF
        </p>
      </div>
    </div>
  );
};

export default FileUploadOverlay;