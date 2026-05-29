/**
 * Тесты для ToastContext.
 */
import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useToast } from '../components/common/ToastContext'

// Test component that uses toast
const TestComponent = () => {
  const { addToast } = useToast()
  return (
    <div>
      <button onClick={() => addToast('Test message', 'success')}>
        Show Toast
      </button>
      <button onClick={() => addToast('Error message', 'error')}>
        Show Error
      </button>
    </div>
  )
}

describe('ToastContext', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  
  afterEach(() => {
    jest.useRealTimers()
  })
  
  test('renders children', () => {
    render(
      <ToastProvider>
        <div>Test Child</div>
      </ToastProvider>
    )
    
    expect(screen.getByText('Test Child')).toBeInTheDocument()
  })
  
  test('shows toast on addToast call', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    const button = screen.getByText('Show Toast')
    await act(async () => {
      button.click()
    })
    
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })
  
  test('shows different toast types', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    await act(async () => {
      screen.getByText('Show Toast').click()
    })
    
    const successToast = screen.getByText('Test message').closest('.toast')
    expect(successToast).toHaveClass('toast-success')
    
    await act(async () => {
      screen.getByText('Show Error').click()
    })
    
    const errorToast = screen.getByText('Error message').closest('.toast')
    expect(errorToast).toHaveClass('toast-error')
  })
  
  test('removes toast after duration', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    await act(async () => {
      screen.getByText('Show Toast').click()
    })
    
    expect(screen.getByText('Test message')).toBeInTheDocument()
    
    // Fast-forward timers
    await act(async () => {
      jest.advanceTimersByTime(5000)
    })
    
    await waitFor(() => {
      expect(screen.queryByText('Test message')).not.toBeInTheDocument()
    })
  })
  
  test('deduplicates identical toasts', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    // Click twice rapidly
    await act(async () => {
      screen.getByText('Show Toast').click()
      screen.getByText('Show Toast').click()
    })
    
    // Should only show one toast
    const toasts = screen.getAllByText('Test message')
    expect(toasts.length).toBe(1)
  })
})

describe('useToast hook', () => {
  test('throws error when used outside provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useToast must be used within ToastProvider')
    
    spy.mockRestore()
  })
})