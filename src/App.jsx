import { useState, useEffect, useMemo } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

// Initialize Firebase
let app, auth, db

// Try to get Firebase config from environment variables (Vercel) or window object (other deployments)
const firebaseConfig = window.__firebase_config || {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

if (firebaseConfig && firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  console.log('Firebase initialized successfully')
} else {
  console.warn('Firebase config not found. Running in development mode without Firebase.')
}

function App() {
  const [transactions, setTransactions] = useState([])
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Form state variables
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('income')

  // Edit mode state
  const [editingId, setEditingId] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  // Filter transactions based on search and filter
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesFilter = filterType === 'all' || transaction.type === filterType
      return matchesSearch && matchesFilter
    })
  }, [transactions, searchTerm, filterType])

  // Calculate financial summaries using useMemo
  const totalIncome = useMemo(() => {
    return transactions
      .filter(transaction => transaction.type === 'income')
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  }, [transactions])

  const totalExpense = useMemo(() => {
    return transactions
      .filter(transaction => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  }, [transactions])

  const totalBalance = useMemo(() => {
    return totalIncome - totalExpense
  }, [totalIncome, totalExpense])

  // Process data for expense breakdown pie chart - GROUP BY DESCRIPTION
  const expenseChartData = useMemo(() => {
    const expenses = transactions.filter(transaction => transaction.type === 'expense')

    // Group expenses by description and sum amounts
    const groupedExpenses = expenses.reduce((acc, expense) => {
      const key = expense.description
      if (!acc[key]) {
        acc[key] = 0
      }
      acc[key] += expense.amount
      return acc
    }, {})

    // Convert to array and sort by amount (highest first)
    return Object.entries(groupedExpenses)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [transactions])

  // Process data for income breakdown pie chart - GROUP BY DESCRIPTION
  const incomeChartData = useMemo(() => {
    const incomes = transactions.filter(transaction => transaction.type === 'income')

    // Group incomes by description and sum amounts
    const groupedIncomes = incomes.reduce((acc, income) => {
      const key = income.description
      if (!acc[key]) {
        acc[key] = 0
      }
      acc[key] += income.amount
      return acc
    }, {})

    // Convert to array and sort by amount (highest first)
    return Object.entries(groupedIncomes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [transactions])

  // Monthly trend data
  const monthlyTrendData = useMemo(() => {
    const monthlyData = {}
    transactions.forEach(transaction => {
      const date = new Date(transaction.createdAt)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, income: 0, expense: 0 }
      }

      if (transaction.type === 'income') {
        monthlyData[monthKey].income += transaction.amount
      } else {
        monthlyData[monthKey].expense += transaction.amount
      }
    })

    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
  }, [transactions])

  // Colors for charts
  const EXPENSE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16']
  const INCOME_COLORS = ['#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6']

  // Firebase authentication
  useEffect(() => {
    if (!auth) {
      console.log('Firebase not configured - using mock user ID')
      setUserId('dev-user-123')
      setLoading(false)
      return
    }

    const initAuth = async () => {
      try {
        if (window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token)
        } else {
          await signInAnonymously(auth)
        }
      } catch (error) {
        console.error('Authentication error:', error)
        setLoading(false)
      }
    }

    initAuth()

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid)
      } else {
        setUserId(null)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  // Load transactions from localStorage on mount (for dev mode)
  useEffect(() => {
    if (!db) {
      // Load from localStorage in dev mode
      const savedData = localStorage.getItem('finance-tracker-transactions')
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData)
          setTransactions(parsed)
          console.log('Loaded transactions from localStorage:', parsed.length, 'transactions')
        } catch (error) {
          console.error('Error loading from localStorage:', error)
        }
      }
      setLoading(false)
    }
  }, [])

  // Load transactions from localStorage on mount
  useEffect(() => {
    const loadFromLocalStorage = () => {
      try {
        const saved = localStorage.getItem('finance-tracker-transactions')
        if (saved) {
          const parsed = JSON.parse(saved)
          setTransactions(parsed)
          console.log('Loaded transactions from localStorage:', parsed.length)
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error)
      }
      setLoading(false)
    }

    if (!userId) return

    // If Firebase is not configured, load from localStorage
    if (!db) {
      loadFromLocalStorage()
      return
    }

    const appId = window.__app_id || import.meta.env.VITE_APP_ID || 'finance-tracker-app'
    const transactionsRef = collection(db, `artifacts/${appId}/users/${userId}/transactions`)
    const q = query(transactionsRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedTransactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toMillis() || Date.now()
      }))
      setTransactions(loadedTransactions)
      setLoading(false)
    }, (error) => {
      console.error('Error loading transactions:', error)
      loadFromLocalStorage()
    })

    return () => unsubscribe()
  }, [userId])

  // Auto-save to localStorage whenever transactions change (if Firebase is not configured)
  useEffect(() => {
    if (!db && transactions.length > 0 && !loading) {
      localStorage.setItem('finance-tracker-transactions', JSON.stringify(transactions))
      console.log('Auto-saved to localStorage:', transactions.length)
    }
  }, [transactions, db, loading])

  const handleAddTransaction = async (e) => {
    e.preventDefault()

    if (!description.trim()) {
      console.error('Validation failed: Description cannot be empty')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      console.error('Validation failed: Amount must be greater than 0')
      return
    }

    if (!userId) {
      console.error('User not authenticated')
      return
    }

    try {
      if (isEditing) {
        // Update existing transaction
        await handleUpdateTransaction()
      } else {
        // Add new transaction
        if (db) {
          const appId = window.__app_id || import.meta.env.VITE_APP_ID || 'finance-tracker-app'
          const transactionsRef = collection(db, `artifacts/${appId}/users/${userId}/transactions`)

          await addDoc(transactionsRef, {
            description: description.trim(),
            amount: parseFloat(amount),
            type,
            createdAt: serverTimestamp(),
          })

          console.log('Transaction added successfully to Firestore')
        } else {
          const newTransaction = {
            id: Date.now(),
            description: description.trim(),
            amount: parseFloat(amount),
            type,
            createdAt: Date.now(),
          }

          setTransactions([newTransaction, ...transactions])
          console.log('Transaction added to local state (dev mode)')
        }
      }

      // Reset form
      setDescription('')
      setAmount('')
      setType('income')
      setIsEditing(false)
      setEditingId(null)
    } catch (error) {
      console.error('Error adding transaction:', error)
    }
  }

  const handleUpdateTransaction = async () => {
    if (!userId || !editingId) return

    try {
      if (db) {
        const appId = window.__app_id || import.meta.env.VITE_APP_ID || 'finance-tracker-app'
        const transactionRef = doc(db, `artifacts/${appId}/users/${userId}/transactions`, editingId)

        await updateDoc(transactionRef, {
          description: description.trim(),
          amount: parseFloat(amount),
          type,
        })

        console.log('Transaction updated successfully')
      } else {
        setTransactions(transactions.map(t =>
          t.id === editingId
            ? { ...t, description: description.trim(), amount: parseFloat(amount), type }
            : t
        ))
        console.log('Transaction updated in local state')
      }
    } catch (error) {
      console.error('Error updating transaction:', error)
    }
  }

  const handleEditTransaction = (transaction) => {
    setDescription(transaction.description)
    setAmount(transaction.amount.toString())
    setType(transaction.type)
    setEditingId(transaction.id)
    setIsEditing(true)

    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setDescription('')
    setAmount('')
    setType('income')
    setIsEditing(false)
    setEditingId(null)
  }

  const handleDeleteTransaction = async (transactionId) => {
    if (!userId) return

    try {
      if (db) {
        const appId = window.__app_id || import.meta.env.VITE_APP_ID || 'finance-tracker-app'
        const transactionRef = doc(db, `artifacts/${appId}/users/${userId}/transactions`, transactionId)
        await deleteDoc(transactionRef)
        console.log('Transaction deleted successfully')
      } else {
        const updated = transactions.filter(t => t.id !== transactionId)
        setTransactions(updated)
        console.log('Transaction deleted from local state')
      }
    } catch (error) {
      console.error('Error deleting transaction:', error)
    }
  }

  // Save to localStorage
  const handleSaveToLocal = () => {
    try {
      localStorage.setItem('finance-tracker-transactions', JSON.stringify(transactions))
      alert(`✅ Saved ${transactions.length} transactions to local storage!`)
      console.log('Saved to localStorage:', transactions.length)
    } catch (error) {
      console.error('Error saving to localStorage:', error)
      alert('❌ Error saving data!')
    }
  }

  // Load from localStorage
  const handleLoadFromLocal = () => {
    try {
      const saved = localStorage.getItem('finance-tracker-transactions')
      if (saved) {
        const parsed = JSON.parse(saved)
        setTransactions(parsed)
        alert(`✅ Loaded ${parsed.length} transactions from local storage!`)
        console.log('Loaded from localStorage:', parsed.length)
      } else {
        alert('⚠️ No saved data found!')
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error)
      alert('❌ Error loading data!')
    }
  }

  // Export to JSON file
  const handleExportToFile = () => {
    try {
      const dataStr = JSON.stringify(transactions, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `finance-tracker-backup-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
      alert(`✅ Exported ${transactions.length} transactions to file!`)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('❌ Error exporting data!')
    }
  }

  // Import from JSON file
  const handleImportFromFile = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result)
        setTransactions(imported)
        localStorage.setItem('finance-tracker-transactions', JSON.stringify(imported))
        alert(`✅ Imported ${imported.length} transactions!`)
        console.log('Imported from file:', imported.length)
      } catch (error) {
        console.error('Error importing:', error)
        alert('❌ Error importing data! Make sure the file is valid JSON.')
      }
    }
    reader.readAsText(file)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-300">Loading your finances...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Finance Dashboard
              </h1>
              <p className="text-gray-400">Track your income and expenses with ease</p>
            </div>

            {/* Save/Load Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSaveToLocal}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                title="Save to browser storage"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>

              <button
                onClick={handleLoadFromLocal}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                title="Load from browser storage"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Load
              </button>

              <button
                onClick={handleExportToFile}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                title="Export to JSON file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>

              <label className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2 cursor-pointer"
                title="Import from JSON file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFromFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Balance Card */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-2xl shadow-2xl border border-blue-500/50 backdrop-blur-sm transform transition-all hover:scale-105 hover:shadow-blue-500/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-blue-100">Total Balance</p>
              <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className={`text-4xl font-bold ${totalBalance >= 0 ? 'text-white' : 'text-red-300'}`}>
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-blue-200 mt-2">
              {totalBalance >= 0 ? '↑ Positive balance' : '↓ Negative balance'}
            </p>
          </div>

          {/* Total Income Card */}
          <div className="bg-gradient-to-br from-green-600 to-green-800 p-6 rounded-2xl shadow-2xl border border-green-500/50 backdrop-blur-sm transform transition-all hover:scale-105 hover:shadow-green-500/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-green-100">Total Income</p>
              <svg className="w-8 h-8 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
            <p className="text-4xl font-bold text-white">
              ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-green-200 mt-2">
              {transactions.filter(t => t.type === 'income').length} transactions
            </p>
          </div>

          {/* Total Expense Card */}
          <div className="bg-gradient-to-br from-red-600 to-red-800 p-6 rounded-2xl shadow-2xl border border-red-500/50 backdrop-blur-sm transform transition-all hover:scale-105 hover:shadow-red-500/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-red-100">Total Expense</p>
              <svg className="w-8 h-8 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </div>
            <p className="text-4xl font-bold text-white">
              ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-red-200 mt-2">
              {transactions.filter(t => t.type === 'expense').length} transactions
            </p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Expense Breakdown Chart */}
          {expenseChartData.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700/50">
              <h2 className="text-2xl font-semibold mb-2 flex items-center">
                <svg className="w-6 h-6 mr-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Expense Breakdown
              </h2>
              <p className="text-sm text-gray-400 mb-4">All Expenses Grouped by Category</p>

              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expenseChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Income Breakdown Chart */}
          {incomeChartData.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700/50">
              <h2 className="text-2xl font-semibold mb-2 flex items-center">
                <svg className="w-6 h-6 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Income Breakdown
              </h2>
              <p className="text-sm text-gray-400 mb-4">All Income Grouped by Category</p>

              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={incomeChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {incomeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={INCOME_COLORS[index % INCOME_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Monthly Trend Chart */}
        {monthlyTrendData.length > 0 && (
          <div className="mb-8 bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700/50">
            <h2 className="text-2xl font-semibold mb-2 flex items-center">
              <svg className="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Monthly Trend
            </h2>
            <p className="text-sm text-gray-400 mb-4">Last 6 Months</p>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                  formatter={(value) => `$${value.toLocaleString()}`}
                />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="Income" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Transactions Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Transaction Form */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700/50 sticky top-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center">
                <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isEditing ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
                </svg>
                {isEditing ? 'Edit Transaction' : 'Add Transaction'}
              </h2>

              {isEditing && (
                <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                  <p className="text-sm text-blue-300">Editing mode - Update the fields below</p>
                </div>
              )}

              <form onSubmit={handleAddTransaction} className="space-y-5">
                {/* Description Input */}
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium text-gray-200">
                    Description
                  </label>
                  <input
                    id="description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Salary, Groceries..."
                    className="w-full h-11 px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-500"
                  />
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <label htmlFor="amount" className="text-sm font-medium text-gray-200">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                    <input
                      id="amount"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full h-11 pl-8 pr-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-500"
                    />
                  </div>
                </div>

                {/* Type Select */}
                <div className="space-y-2">
                  <label htmlFor="type" className="text-sm font-medium text-gray-200">
                    Type
                  </label>
                  <select
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full h-11 px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-500 cursor-pointer"
                  >
                    <option value="income">💰 Income</option>
                    <option value="expense">💸 Expense</option>
                  </select>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 h-11 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:from-blue-800 active:to-purple-800 text-white font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {isEditing ? '✓ Update' : '+ Add Transaction'}
                  </button>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="h-11 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Transactions List */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <h2 className="text-2xl font-semibold flex items-center">
                  <svg className="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Transactions
                </h2>

                {/* Search and Filter */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer transition-all"
                  >
                    <option value="all">All</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>

              {/* Transaction List */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-gray-400 text-lg">No transactions found</p>
                    <p className="text-gray-500 text-sm mt-2">Add your first transaction to get started!</p>
                  </div>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-all group"
                    >
                      <div className="flex-1">
                        <p className="text-lg font-medium text-white">{transaction.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xl font-bold ${
                            transaction.type === 'income' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <button
                          onClick={() => handleEditTransaction(transaction)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all"
                          title="Edit transaction"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete transaction"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.7);
        }
      `}</style>
    </div>
  )
}

export default App
