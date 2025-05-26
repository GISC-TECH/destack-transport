// destack-transport-frontend/src/services/uploadService.js
import apiClient from './api';

export default {
  uploadSingleFile(file, onUploadProgress) { // Adicionado onUploadProgress
    const formData = new FormData();
    formData.append('arquivo_xml', file);

    return apiClient.post('/upload/single', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress // Passa a função de callback para o Axios
    });
  },

  // Se você realmente quiser um endpoint de batch no backend:
  // uploadBatchFiles(files, onUploadProgress) {
  //   const formData = new FormData();
  //   files.forEach((file, index) => {
  //     formData.append('arquivos_xml', file, file.name); // O backend espera 'arquivos_xml'
  //   });
  //   return apiClient.post('/upload/batch', formData, {
  //     headers: {
  //       'Content-Type': 'multipart/form-data',
  //     },
  //     onUploadProgress
  //   });
  // },

  listUploads(page = 1, limit = 10) {
    return apiClient.get('/uploads', {
      params: { page, limit },
    });
  },

  getUploadDetails(uploadId) {
    return apiClient.get(`/uploads/${uploadId}`);
  },
};