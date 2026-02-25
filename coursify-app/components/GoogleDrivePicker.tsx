'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

interface GoogleDrivePickerProps {
  onSelect: (videoUrl: string, filePath: string) => void
  onCancel: () => void
}

export function GoogleDrivePicker({ onSelect, onCancel }: GoogleDrivePickerProps) {
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // TODO: Check if user has Google Drive connection
      const { data, error } = await supabase
        .from('google_drive_connections')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data && !error) {
        setConnected(true)
        loadFiles()
      }
    } catch (err) {
      console.error('Error checking connection:', err)
    }
  }

  const handleConnect = async () => {
    setLoading(true)
    try {
      // TODO: Implement Google Drive OAuth flow
      // This should redirect to Google OAuth and then back to callback
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/drive.readonly',
          redirectTo: `${window.location.origin}/auth/drive-callback`,
        },
      })

      if (error) throw error
    } catch (err: any) {
      console.error('Error connecting to Google Drive:', err)
      alert('Failed to connect to Google Drive')
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async () => {
    setLoading(true)
    try {
      // TODO: Fetch files from Google Drive API
      // This should use the stored access token to call Google Drive API
      // For now, showing placeholder
      setFiles([])
    } catch (err) {
      console.error('Error loading files:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (file: any) => {
    // TODO: Get playable URL for the selected file
    // Google Drive files need to be converted to a playable video URL
    const videoUrl = `https://drive.google.com/file/d/${file.id}/preview`
    onSelect(videoUrl, file.id)
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium">Select Video from Google Drive</h4>
        <button
          onClick={onCancel}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>

      {!connected ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">Connect your Google Drive account to select videos</p>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect Google Drive'}
          </button>
        </div>
      ) : (
        <div>
          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No video files found. Make sure you have videos in your Google Drive.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleFileSelect(file)}
                  className="w-full text-left px-3 py-2 border rounded hover:bg-gray-50"
                >
                  {file.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
