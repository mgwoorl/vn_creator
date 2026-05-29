import React from 'react'
import { AuthProvider } from './AuthContext'
import { ProjectProvider } from './ProjectContext'
import { FileProvider } from './FileContext'
import { SceneProvider } from './SceneContext'
import { PlaythroughProvider } from './PlaythroughContext'
import { ToastProvider } from '../components/common/ToastContext'

export const AppProviders = ({ children }) => (
  <ToastProvider>
    <AuthProvider>
      <ProjectProvider>
        <FileProvider>
          <SceneProvider>
            <PlaythroughProvider>
              {children}
            </PlaythroughProvider>
          </SceneProvider>
        </FileProvider>
      </ProjectProvider>
    </AuthProvider>
  </ToastProvider>
)