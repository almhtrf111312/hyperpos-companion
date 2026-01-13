// Google Drive API integration for backup storage

const GOOGLE_CLIENT_ID_KEY = 'hyperpos_google_client_id';
const GOOGLE_TOKENS_KEY = 'hyperpos_google_tokens';
const GOOGLE_DRIVE_FOLDER_KEY = 'hyperpos_google_drive_folder';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
}

export interface GoogleDriveTokens {
  access_token: string;
  expires_at: number;
  refresh_token?: string;
}

export interface GoogleDriveUserInfo {
  email: string;
  name: string;
  picture?: string;
}

// Storage functions
export const getStoredClientId = (): string | null => {
  return localStorage.getItem(GOOGLE_CLIENT_ID_KEY);
};

export const setStoredClientId = (clientId: string): void => {
  localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId);
};

export const removeStoredClientId = (): void => {
  localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
};

export const getStoredTokens = (): GoogleDriveTokens | null => {
  const tokens = localStorage.getItem(GOOGLE_TOKENS_KEY);
  if (!tokens) return null;
  try {
    return JSON.parse(tokens);
  } catch {
    return null;
  }
};

export const setStoredTokens = (tokens: GoogleDriveTokens): void => {
  localStorage.setItem(GOOGLE_TOKENS_KEY, JSON.stringify(tokens));
};

export const removeStoredTokens = (): void => {
  localStorage.removeItem(GOOGLE_TOKENS_KEY);
};

export const getStoredFolderId = (): string | null => {
  return localStorage.getItem(GOOGLE_DRIVE_FOLDER_KEY);
};

export const setStoredFolderId = (folderId: string): void => {
  localStorage.setItem(GOOGLE_DRIVE_FOLDER_KEY, folderId);
};

export const removeStoredFolderId = (): void => {
  localStorage.removeItem(GOOGLE_DRIVE_FOLDER_KEY);
};

// Check if tokens are valid
export const isTokenValid = (tokens: GoogleDriveTokens | null): boolean => {
  if (!tokens) return false;
  return Date.now() < tokens.expires_at - 60000; // 1 minute buffer
};

// Initialize Google OAuth
export const initiateGoogleAuth = (clientId: string): void => {
  const redirectUri = window.location.origin;
  const scope = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('state', 'google_drive_auth');
  
  // Open in popup
  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  
  window.open(
    authUrl.toString(),
    'Google Auth',
    `width=${width},height=${height},left=${left},top=${top}`
  );
};

// Parse OAuth callback from URL hash
export const parseAuthCallback = (): GoogleDriveTokens | null => {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return null;
  
  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');
  const state = params.get('state');
  
  if (state !== 'google_drive_auth' || !accessToken || !expiresIn) return null;
  
  const tokens: GoogleDriveTokens = {
    access_token: accessToken,
    expires_at: Date.now() + parseInt(expiresIn) * 1000,
  };
  
  // Clear the hash from URL
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  
  return tokens;
};

// Get user info
export const getUserInfo = async (accessToken: string): Promise<GoogleDriveUserInfo | null> => {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch {
    return null;
  }
};

// Find or create HyperPOS backup folder
export const getOrCreateBackupFolder = async (accessToken: string): Promise<string | null> => {
  const folderName = 'HyperPOS Backups';
  
  try {
    // Search for existing folder
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!searchResponse.ok) return null;
    
    const searchData = await searchResponse.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
    
    // Create new folder
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    
    if (!createResponse.ok) return null;
    
    const createData = await createResponse.json();
    return createData.id;
  } catch {
    return null;
  }
};

// List backup files from folder
export const listBackupFiles = async (accessToken: string, folderId: string): Promise<GoogleDriveFile[]> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,mimeType,size,createdTime,modifiedTime)&orderBy=createdTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.files || [];
  } catch {
    return [];
  }
};

// Upload backup file
export const uploadBackup = async (
  accessToken: string,
  folderId: string,
  fileName: string,
  content: object
): Promise<GoogleDriveFile | null> => {
  try {
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId],
    };
    
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append(
      'file',
      new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
    );
    
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );
    
    if (!response.ok) return null;
    
    return await response.json();
  } catch {
    return null;
  }
};

// Download backup file
export const downloadBackup = async (accessToken: string, fileId: string): Promise<object | null> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) return null;
    
    return await response.json();
  } catch {
    return null;
  }
};

// Delete backup file
export const deleteBackupFile = async (accessToken: string, fileId: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
};

// Disconnect from Google Drive
export const disconnectGoogleDrive = (): void => {
  removeStoredTokens();
  removeStoredFolderId();
};

// Format file size
export const formatFileSize = (bytes: string | number): string => {
  const size = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (isNaN(size) || size === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return `${(size / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};
