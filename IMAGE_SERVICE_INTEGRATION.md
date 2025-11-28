# Image Service Integration with Homeshoppie

This document explains how the secure image service has been integrated with Homeshoppie to provide advanced image upload, management, and optimization features for product images.

## Overview

The integration provides:
- **Auto-Registration**: Seamless user registration with the image service
- **Proxy Endpoints**: All image operations go through Homeshoppie server
- **Organized Storage**: Images stored in date/product-based folder structure
- **Secure Uploads**: JWT authentication handled automatically
- **Multiple Image Variants**: Automatic size optimization (thumbnail, small, medium, large, original)
- **Drag & Drop Interface**: Modern file upload with validation
- **Image Metadata**: Product association and metadata management

## Architecture

### Proxy-Based Architecture

Instead of direct client-to-image-service communication, all requests go through Homeshoppie:

```
Client → Homeshoppie API → Image Service → Organized Storage
```

**Benefits:**
- Auto-registration of admin users
- Organized folder structure (prevents overwhelming single folder)
- Centralized authentication
- Better security and control

### Organized Storage Structure

Images are stored in organized folders:
```
uploads/
├── product/
│   └── 2024/
│       └── 11/
│           └── 28/
│               ├── product-123/
│               │   ├── original_image.jpg
│               │   └── variants/
│               │       ├── thumbnail.webp
│               │       ├── small.webp
│               │       └── medium.webp
│               └── general/
```

## Setup Instructions

### 1. Environment Configuration

Copy the environment example and configure your settings:

```bash
cp .env.example .env.local
```

Update the following variables in `.env.local`:

```env
# Image Service Configuration (Server-side)
IMAGE_SERVICE_URL="http://localhost:3001/api"
IMAGE_SERVICE_AUTO_PASSWORD="homeshoppie_secure_2024"

# Client-side endpoints (use homeshoppie proxy endpoints)  
NEXT_PUBLIC_IMAGES_API_URL="/api/images"
```

### 2. Start the Image Service

Navigate to the image-service directory and start the service:

```bash
cd ../image-service
npm install
npm start
```

The image service should be running on `http://localhost:3001`

### 3. Start Homeshoppie

```bash
cd homeshoppie
npm install
npm run dev
```

Homeshoppie should be running on `http://localhost:3000`

## Architecture

### Components

1. **Image Service Client** (`src/lib/imageService.ts`)
   - Handles all communication with the image service API
   - Manages authentication tokens
   - Provides methods for upload, delete, and metadata operations

2. **Image Uploader Component** (`src/components/ImageUploader.tsx`)
   - React component with drag & drop functionality
   - Handles file validation and upload progress
   - Displays uploaded images with management options
   - Integrates with the image service client

3. **Authentication Hook** (`src/hooks/useImageService.ts`)
   - Manages image service authentication
   - Auto-authenticates admin users
   - Handles authentication errors and retry logic

### Integration Points

The image service is integrated into:

- **New Product Page** (`/admin/products/new`)
- **Edit Product Page** (`/admin/products/[id]/edit`)

## Features

### Secure Upload Process

1. Admin users are automatically authenticated with the image service
2. Images are uploaded with product metadata (productId, category, tags)
3. Multiple size variants are automatically generated
4. Access tokens are provided for secure image retrieval

### Image Management

- **Upload**: Drag & drop or click to select multiple images
- **Preview**: Thumbnail previews with original names
- **Remove**: Delete images from both frontend and image service
- **Validation**: File type and size validation (max 5MB)
- **Limits**: Configurable maximum images per product

### Image Variants

The image service automatically generates these variants:
- **Thumbnail**: 150x150px (WebP)
- **Small**: 300x300px (WebP)
- **Medium**: 600x600px (WebP)
- **Large**: 1200x1200px (WebP)
- **Original**: Uploaded image format

## Usage Instructions

### For Admin Users

1. **Navigate to Admin Panel**: `/admin`
2. **Create New Product**: 
   - Click "Add New Product"
   - Fill in basic product information
   - Use the image uploader to add product images
   - Images are automatically uploaded to the secure service

3. **Edit Existing Product**:
   - Click "Edit" on any product
   - Use the image uploader to manage product images
   - Add, remove, or replace images as needed

### Image Upload Interface

The image uploader provides:
- **Drag & Drop Zone**: Drop images directly onto the upload area
- **File Browser**: Click to open file selection dialog
- **Progress Indicators**: Visual feedback during upload
- **Image Grid**: Preview of uploaded images with management options
- **Error Handling**: Clear error messages for failed uploads

## API Integration

### Authentication Flow

```javascript
// Automatic authentication for admin users
const { isAuthenticated, login } = useImageService()

// Manual authentication if needed
const success = await login()
```

### Image Upload

```javascript
// Upload single image
const result = await imageService.uploadImage(file, {
  entityType: 'product',
  productId: 'product-123',
  category: 'product',
  alt: 'Product image description',
  title: 'Product image title'
})

// Upload multiple images
const results = await imageService.uploadBulkImages(files, {
  entityType: 'product',
  productId: 'product-123',
  category: 'product'
})
```

### Image Retrieval

```javascript
// Get image URL with size variant
const imageUrl = imageService.getImageUrl(imageId, 'medium')

// Get image URL with access token for public access
const publicUrl = imageService.getImageUrlWithToken(imageId, accessToken, 'large')
```

## Testing the Integration

### 1. Test Image Upload

1. Start both services (image-service and homeshoppie)
2. Login as an admin user in homeshoppie
3. Navigate to `/admin/products/new`
4. Try uploading images using:
   - Drag & drop multiple image files
   - Click to browse and select files
5. Verify that:
   - Images upload successfully
   - Thumbnails are displayed
   - Progress indicators work
   - Error messages appear for invalid files

### 2. Test Image Management

1. Upload several images to a product
2. Try removing images
3. Edit an existing product with images
4. Verify that:
   - Images persist across page loads
   - Removal works correctly
   - Image data is stored in the image service

### 3. Test Error Handling

1. Try uploading files that are too large (>5MB)
2. Try uploading non-image files
3. Disconnect the image service and try uploading
4. Verify that:
   - Appropriate error messages are shown
   - The interface handles errors gracefully
   - Authentication errors are displayed

### 4. Test Image Variants

1. Upload a large image
2. Check the image service uploads directory
3. Verify that multiple size variants are created
4. Test accessing different sizes via URL

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Ensure image service is running on the correct port
   - Check environment variables are set correctly
   - Verify admin user has proper role in homeshoppie

2. **Upload Failures**
   - Check image service logs for errors
   - Verify file size limits (5MB max)
   - Ensure file types are supported (JPG, PNG, WebP)

3. **Image Not Loading**
   - Check if image service is accessible
   - Verify access tokens are valid
   - Check CORS configuration if accessing from different domain

### Debug Information

Enable debug logging by setting environment variables:

```env
DEBUG=image-service:*
NODE_ENV=development
```

## Security Considerations

- All uploads require authentication
- Images are stored with unique identifiers
- Access tokens provide secure image access
- File validation prevents malicious uploads
- CORS protection limits access origins

## Performance Optimization

- Automatic WebP conversion for smaller file sizes
- Multiple size variants for responsive images
- Efficient thumbnail generation
- Caching headers for better performance

## Next Steps

1. **Production Setup**: Configure production URLs and security settings
2. **CDN Integration**: Consider integrating with AWS S3 or similar services
3. **Image SEO**: Implement proper alt text and metadata management
4. **Bulk Operations**: Add bulk upload and management features
5. **Image Editing**: Consider adding basic image editing capabilities

## Support

For issues or questions regarding the image service integration:
1. Check the troubleshooting section above
2. Review the image service API documentation
3. Check both service logs for error details
4. Ensure all dependencies are properly installed and configured
