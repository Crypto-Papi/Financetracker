import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

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
  const [category, setCategory] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [remainingBalance, setRemainingBalance] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Edit mode state
  const [editingId, setEditingId] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  // Debt balance modal state
  const [showDebtModal, setShowDebtModal] = useState(false)
  const [debtModalValue, setDebtModalValue] = useState('')

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date())

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

  // Process data for expense breakdown - TOP 6 + OTHER
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
    const sorted = Object.entries(groupedExpenses)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Take top 6, group rest as "Other"
    if (sorted.length <= 6) {
      return sorted
    }

    const top6 = sorted.slice(0, 6)
    const others = sorted.slice(6)
    const otherTotal = others.reduce((sum, item) => sum + item.value, 0)

    if (otherTotal > 0) {
      top6.push({ name: 'Other', value: otherTotal })
    }

    return top6
  }, [transactions])

  // Process data for income breakdown - TOP 6 + OTHER
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
    const sorted = Object.entries(groupedIncomes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Take top 6, group rest as "Other"
    if (sorted.length <= 6) {
      return sorted
    }

    const top6 = sorted.slice(0, 6)
    const others = sorted.slice(6)
    const otherTotal = others.reduce((sum, item) => sum + item.value, 0)

    if (otherTotal > 0) {
      top6.push({ name: 'Other', value: otherTotal })
    }

    return top6
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
            category: category.trim() || null,
            isRecurring: isRecurring,
            remainingBalance: remainingBalance ? parseFloat(remainingBalance) : null,
            dueDate: dueDate ? parseInt(dueDate) : null,
            createdAt: serverTimestamp(),
          })

          console.log('Transaction added successfully to Firestore')
        } else {
          const newTransaction = {
            id: Date.now(),
            description: description.trim(),
            amount: parseFloat(amount),
            type,
            category: category.trim() || null,
            isRecurring: isRecurring,
            remainingBalance: remainingBalance ? parseFloat(remainingBalance) : null,
            dueDate: dueDate ? parseInt(dueDate) : null,
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
      setCategory('')
      setIsRecurring(false)
      setRemainingBalance('')
      setDueDate('')
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
          category: category.trim() || null,
          isRecurring: isRecurring,
          remainingBalance: remainingBalance ? parseFloat(remainingBalance) : null,
          dueDate: dueDate ? parseInt(dueDate) : null,
        })

        console.log('Transaction updated successfully')
      } else {
        setTransactions(transactions.map(t =>
          t.id === editingId
            ? {
                ...t,
                description: description.trim(),
                amount: parseFloat(amount),
                type,
                category: category.trim() || null,
                isRecurring: isRecurring,
                remainingBalance: remainingBalance ? parseFloat(remainingBalance) : null,
                dueDate: dueDate ? parseInt(dueDate) : null,
              }
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
    setCategory(transaction.category || '')
    setIsRecurring(transaction.isRecurring || false)
    setRemainingBalance(transaction.remainingBalance ? transaction.remainingBalance.toString() : '')
    setDueDate(transaction.dueDate ? transaction.dueDate.toString() : '')
    setEditingId(transaction.id)
    setIsEditing(true)

    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setDescription('')
    setAmount('')
    setType('income')
    setCategory('')
    setIsRecurring(false)
    setRemainingBalance('')
    setDueDate('')
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

  // Calculate recurring obligations and debt totals
  const recurringObligations = useMemo(() => {
    const recurring = transactions.filter(t => t.isRecurring && t.type === 'expense')

    // Group by category
    const grouped = recurring.reduce((acc, t) => {
      const cat = t.category || 'Other'
      if (!acc[cat]) {
        acc[cat] = {
          category: cat,
          totalMonthly: 0,
          totalBalance: 0,
          paidCount: 0,
          paidAmount: 0,
          items: []
        }
      }
      acc[cat].totalMonthly += t.amount
      acc[cat].totalBalance += t.remainingBalance || 0
      // Check if paid this month
      if (t.paidDate) {
        const paidDate = new Date(t.paidDate)
        const now = new Date()
        if (paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear()) {
          acc[cat].paidCount += 1
          acc[cat].paidAmount += t.amount
        }
      }
      acc[cat].items.push(t)
      return acc
    }, {})

    return Object.values(grouped)
  }, [transactions])

  const totalMonthlyObligations = useMemo(() => {
    return recurringObligations.reduce((sum, cat) => sum + cat.totalMonthly, 0)
  }, [recurringObligations])

  const totalDebtBalance = useMemo(() => {
    return transactions
      .filter(t => t.remainingBalance && t.remainingBalance > 0)
      .reduce((sum, t) => sum + t.remainingBalance, 0)
  }, [transactions])

  // Payment tracking statistics
  const paymentStats = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const recurringBills = transactions.filter(t => t.isRecurring && t.type === 'expense')
    const totalBills = recurringBills.length

    const paidBills = recurringBills.filter(t => {
      if (!t.paidDate) return false
      const paidDate = new Date(t.paidDate)
      return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear
    })

    const paidCount = paidBills.length
    const paidAmount = paidBills.reduce((sum, t) => sum + t.amount, 0)
    const unpaidAmount = totalMonthlyObligations - paidAmount
    const progressPercent = totalBills > 0 ? (paidCount / totalBills) * 100 : 0

    return {
      totalBills,
      paidCount,
      unpaidCount: totalBills - paidCount,
      paidAmount,
      unpaidAmount,
      progressPercent
    }
  }, [transactions, totalMonthlyObligations])

  // Calculate bills by due date for calendar
  const billsByDueDate = useMemo(() => {
    const billMap = {}
    const recurringBills = transactions.filter(t => t.isRecurring && t.type === 'expense' && t.dueDate)

    recurringBills.forEach(bill => {
      const dueDay = parseInt(bill.dueDate)
      if (!isNaN(dueDay) && dueDay >= 1 && dueDay <= 31) {
        if (!billMap[dueDay]) {
          billMap[dueDay] = []
        }
        billMap[dueDay].push(bill)
      }
    })

    return billMap
  }, [transactions])

  // Get calendar data for current month
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        bills: billsByDueDate[day] || [],
        totalAmount: (billsByDueDate[day] || []).reduce((sum, bill) => sum + bill.amount, 0)
      })
    }

    return days
  }, [currentMonth, billsByDueDate])

  // Check if a bill is paid this month
  const isBillPaidThisMonth = (transaction) => {
    if (!transaction.paidDate) return false
    const paidDate = new Date(transaction.paidDate)
    const now = new Date()
    return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear()
  }

  // Toggle paid status for a bill
  const handleTogglePaid = async (transactionId) => {
    if (!userId) return

    const transaction = transactions.find(t => t.id === transactionId)
    if (!transaction) return

    const isPaid = isBillPaidThisMonth(transaction)
    const newPaidDate = isPaid ? null : Date.now()

    try {
      if (db) {
        const appId = window.__app_id || import.meta.env.VITE_APP_ID || 'finance-tracker-app'
        const transactionRef = doc(db, `artifacts/${appId}/users/${userId}/transactions`, transactionId)
        await updateDoc(transactionRef, { paidDate: newPaidDate })
        console.log('Payment status updated')
      } else {
        setTransactions(transactions.map(t =>
          t.id === transactionId ? { ...t, paidDate: newPaidDate } : t
        ))
        console.log('Payment status updated in local state')
      }
    } catch (error) {
      console.error('Error updating payment status:', error)
    }
  }

  // Reset all bills for new month
  const handleResetAllBills = async () => {
    if (!userId) return

    const confirmed = window.confirm('Reset all bills to unpaid for this month? This will clear all payment checkmarks.')
    if (!confirmed) return

    const recurringBills = transactions.filter(t => t.isRecurring && t.type === 'expense')

    try {
      if (db) {
        const appId = window.__app_id || import.meta.env.VITE_APP_ID || 'finance-tracker-app'
        for (const bill of recurringBills) {
          const transactionRef = doc(db, `artifacts/${appId}/users/${userId}/transactions`, bill.id)
          await updateDoc(transactionRef, { paidDate: null })
        }
        console.log('All bills reset')
      } else {
        setTransactions(transactions.map(t =>
          t.isRecurring && t.type === 'expense' ? { ...t, paidDate: null } : t
        ))
        console.log('All bills reset in local state')
      }
    } catch (error) {
      console.error('Error resetting bills:', error)
    }
  }

  // Handle debt balance update
  const handleUpdateDebtBalance = async () => {
    const newDebtAmount = parseFloat(debtModalValue)
    if (isNaN(newDebtAmount) || newDebtAmount < 0) {
      alert('Please enter a valid amount')
      return
    }

    const debtTransactions = transactions.filter(t => t.type === 'expense' && t.remainingBalance > 0)
    if (debtTransactions.length === 0) {
      alert('No debt transactions found. Please add a debt transaction first.')
      setShowDebtModal(false)
      return
    }

    const currentTotalDebt = debtTransactions.reduce((sum, t) => sum + (t.remainingBalance || 0), 0)
    const difference = newDebtAmount - currentTotalDebt

    try {
      if (db) {
        const appId = window.__app_id || import.meta.env.VITE_APP_ID || 'finance-tracker-app'
        // Distribute the difference proportionally across all debt transactions
        for (const transaction of debtTransactions) {
          const proportion = (transaction.remainingBalance || 0) / currentTotalDebt
          const newBalance = Math.max(0, (transaction.remainingBalance || 0) + (difference * proportion))
          const transactionRef = doc(db, `artifacts/${appId}/users/${userId}/transactions`, transaction.id)
          await updateDoc(transactionRef, { remainingBalance: newBalance })
        }
        console.log('Debt balance updated')
      } else {
        // Update local state
        const updatedTransactions = transactions.map(t => {
          if (t.type === 'expense' && t.remainingBalance > 0) {
            const proportion = (t.remainingBalance || 0) / currentTotalDebt
            const newBalance = Math.max(0, (t.remainingBalance || 0) + (difference * proportion))
            return { ...t, remainingBalance: newBalance }
          }
          return t
        })
        setTransactions(updatedTransactions)
        console.log('Debt balance updated in local state')
      }
      setShowDebtModal(false)
      setDebtModalValue('')
    } catch (error) {
      console.error('Error updating debt balance:', error)
      alert('Error updating debt balance')
    }
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
              <p className="text-sm font-medium text-blue-100">Monthly Balance</p>
              <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className={`text-4xl font-bold ${totalBalance >= 0 ? 'text-white' : 'text-red-300'}`}>
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-blue-200 mt-2">
              {totalBalance >= 0 ? '↑ Positive monthly balance' : '↓ Negative monthly balance'}
            </p>
          </div>

          {/* Total Income Card */}
          <div className="bg-gradient-to-br from-green-600 to-green-800 p-6 rounded-2xl shadow-2xl border border-green-500/50 backdrop-blur-sm transform transition-all hover:scale-105 hover:shadow-green-500/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-green-100">Monthly Income</p>
              <svg className="w-8 h-8 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
            <p className="text-4xl font-bold text-white">
              ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-green-200 mt-2">
              {transactions.filter(t => t.type === 'income').length} transactions this month
            </p>
          </div>

          {/* Total Expense Card */}
          <div className="bg-gradient-to-br from-red-600 to-red-800 p-6 rounded-2xl shadow-2xl border border-red-500/50 backdrop-blur-sm transform transition-all hover:scale-105 hover:shadow-red-500/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-red-100">Monthly Expenses</p>
              <svg className="w-8 h-8 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </div>
            <p className="text-4xl font-bold text-white">
              ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-red-200 mt-2">
              {transactions.filter(t => t.type === 'expense').length} transactions this month
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
              <p className="text-sm text-gray-400 mb-4">Top Categories (Others grouped)</p>

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
              <p className="text-sm text-gray-400 mb-4">Top Sources (Others grouped)</p>

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

        {/* Spending by Category - Professional View */}
        {expenseChartData.length > 0 && (
          <div className="mb-8 bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700/50">
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Spending by Category
            </h2>

            <div className="space-y-4">
              {expenseChartData.map((category, index) => {
                const percentage = (category.value / totalExpense) * 100
                return (
                  <div key={index} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: EXPENSE_COLORS[index % EXPENSE_COLORS.length] }}
                        />
                        <span className="font-medium text-white">{category.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400 text-sm">{percentage.toFixed(1)}%</span>
                        <span className="font-bold text-white min-w-[100px] text-right">
                          ${category.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: EXPENSE_COLORS[index % EXPENSE_COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-300">Total Monthly Expenses</span>
                <span className="text-2xl font-bold text-red-400">
                  ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Obligations Summary */}
        {recurringObligations.length > 0 && (
          <div className="mb-8">
            {/* Header with Reset Button */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h2 className="text-3xl font-bold flex items-center">
                <svg className="w-8 h-8 mr-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Monthly Bills Tracker
              </h2>
              <button
                onClick={handleResetAllBills}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white font-medium rounded-lg transition-all flex items-center gap-2 text-sm"
                title="Reset all bills for new month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset for New Month
              </button>
            </div>

            {/* Payment Progress Card */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 rounded-2xl shadow-2xl border border-gray-700/50 mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Payment Progress
                  </h3>
                  <p className="text-sm text-gray-400">
                    {paymentStats.paidCount} of {paymentStats.totalBills} bills paid
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">${paymentStats.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-400">Paid</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-400">${paymentStats.unpaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-400">Remaining</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-green-500 to-emerald-400"
                    style={{ width: `${paymentStats.progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>{paymentStats.progressPercent.toFixed(0)}% Complete</span>
                  <span>{paymentStats.unpaidCount} bills remaining</span>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Total Monthly Obligations */}
              <div className="bg-gradient-to-br from-yellow-600 to-yellow-800 p-6 rounded-2xl shadow-2xl border border-yellow-500/50">
                <p className="text-sm font-medium text-yellow-100 mb-2">Total Monthly Obligations</p>
                <p className="text-4xl font-bold text-white">
                  ${totalMonthlyObligations.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-yellow-200 mt-2">{paymentStats.totalBills} recurring payments</p>
              </div>

              {/* Total Debt Balance */}
              <div
                onClick={() => {
                  setShowDebtModal(true)
                  setDebtModalValue(totalDebtBalance.toFixed(2))
                }}
                className="bg-gradient-to-br from-red-600 to-red-800 p-6 rounded-2xl shadow-2xl border border-red-500/50 cursor-pointer hover:shadow-red-500/50 hover:scale-105 transition-all duration-200 group"
              >
                <p className="text-sm font-medium text-red-100 mb-2 flex items-center gap-2">
                  Total Debt Balance
                  <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </p>
                <p className="text-4xl font-bold text-white">
                  ${totalDebtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-red-200 mt-2">Click to edit • Outstanding balances</p>
              </div>

              {/* Net After Obligations */}
              <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-6 rounded-2xl shadow-2xl border border-purple-500/50">
                <p className="text-sm font-medium text-purple-100 mb-2">Net After Obligations</p>
                <p className={`text-4xl font-bold ${(totalIncome - totalExpense - totalMonthlyObligations) >= 0 ? 'text-white' : 'text-red-300'}`}>
                  ${(totalIncome - totalExpense - totalMonthlyObligations).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-purple-200 mt-2">Income - Expenses - Obligations</p>
              </div>
            </div>

            {/* Bills Checklist by Category */}
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700/50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Bills Checklist
                </h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-400">
                    <span className="w-3 h-3 bg-green-500 rounded-full"></span> Paid
                  </span>
                  <span className="flex items-center gap-1 text-gray-400">
                    <span className="w-3 h-3 bg-gray-600 rounded-full border-2 border-gray-500"></span> Unpaid
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {recurringObligations.map((cat) => (
                  <div key={cat.category} className="bg-gray-700/30 p-4 rounded-xl border border-gray-600/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-yellow-300 text-lg">{cat.category}</h4>
                        <span className="text-xs px-2 py-1 bg-gray-600/50 rounded-full text-gray-300">
                          {cat.paidCount}/{cat.items.length} paid
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-white">
                          ${cat.totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo
                        </p>
                        {cat.totalBalance > 0 && (
                          <p className="text-xs text-red-400">
                            Debt: ${cat.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {cat.items.map((item) => {
                        const isPaid = isBillPaidThisMonth(item)
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer group
                              ${isPaid
                                ? 'bg-green-900/30 border border-green-500/30 hover:bg-green-900/40'
                                : 'bg-gray-800/50 border border-gray-600/30 hover:bg-gray-700/50 hover:border-yellow-500/30'
                              }`}
                            onClick={() => handleTogglePaid(item.id)}
                          >
                            <div className="flex items-center gap-3">
                              {/* Checkbox */}
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all
                                ${isPaid
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-700 border-2 border-gray-500 group-hover:border-yellow-500'
                                }`}
                              >
                                {isPaid && (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>

                              <div>
                                <span className={`font-medium ${isPaid ? 'text-green-300 line-through' : 'text-white'}`}>
                                  {item.description}
                                </span>
                                {isPaid && item.paidDate && (
                                  <p className="text-xs text-green-400/70">
                                    Paid {new Date(item.paidDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <span className={`font-bold ${isPaid ? 'text-green-400' : 'text-white'}`}>
                                ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                              {item.remainingBalance && item.remainingBalance > 0 && (
                                <span className="text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded">
                                  ${item.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} owed
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bills Calendar */}
            {Object.keys(billsByDueDate).length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700/50 mt-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Bills Calendar
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-semibold min-w-[150px] text-center">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="space-y-4">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-xs font-semibold text-gray-400 py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar days */}
                  <div className="grid grid-cols-7 gap-2">
                    {calendarData.map((dayData, index) => {
                      if (!dayData) {
                        return <div key={`empty-${index}`} className="aspect-square" />
                      }

                      const billCount = dayData.bills.length
                      const isHighActivity = billCount >= 3
                      const isMediumActivity = billCount === 2
                      const isLowActivity = billCount === 1

                      return (
                        <div
                          key={dayData.day}
                          className={`aspect-square p-2 rounded-lg border-2 transition-all cursor-pointer group
                            ${isHighActivity
                              ? 'bg-red-900/40 border-red-500/60 hover:bg-red-900/60'
                              : isMediumActivity
                              ? 'bg-yellow-900/40 border-yellow-500/60 hover:bg-yellow-900/60'
                              : isLowActivity
                              ? 'bg-blue-900/40 border-blue-500/60 hover:bg-blue-900/60'
                              : 'bg-gray-700/30 border-gray-600/30 hover:bg-gray-700/50'
                            }`}
                          title={billCount > 0 ? `${billCount} bill${billCount > 1 ? 's' : ''} due` : ''}
                        >
                          <div className="flex flex-col h-full">
                            <span className="text-sm font-bold text-white">{dayData.day}</span>
                            {billCount > 0 && (
                              <div className="mt-auto">
                                <div className="flex flex-wrap gap-1">
                                  {dayData.bills.slice(0, 2).map((bill, idx) => (
                                    <div
                                      key={idx}
                                      className="text-xs px-1.5 py-0.5 bg-gray-900/60 rounded truncate"
                                      title={bill.description}
                                    >
                                      {bill.description.substring(0, 8)}
                                    </div>
                                  ))}
                                  {billCount > 2 && (
                                    <div className="text-xs px-1.5 py-0.5 bg-gray-900/60 rounded font-semibold">
                                      +{billCount - 2}
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-gray-300 mt-1 font-semibold">
                                  ${dayData.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-gray-700/50">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded bg-red-900/40 border border-red-500/60"></div>
                    <span className="text-gray-300">3+ bills</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded bg-yellow-900/40 border border-yellow-500/60"></div>
                    <span className="text-gray-300">2 bills</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded bg-blue-900/40 border border-blue-500/60"></div>
                    <span className="text-gray-300">1 bill</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded bg-gray-700/30 border border-gray-600/30"></div>
                    <span className="text-gray-300">No bills</span>
                  </div>
                </div>
              </div>
            )}
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

                {/* Category Dropdown */}
                <div className="space-y-2">
                  <label htmlFor="category" className="text-sm font-medium text-gray-200">
                    Category <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-11 px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-500 cursor-pointer"
                  >
                    <option value="">-- Select Category --</option>
                    <optgroup label="💳 Debt Payments">
                      <option value="Credit Card Payment">Credit Card Payment</option>
                      <option value="Auto Loan">Auto Loan</option>
                      <option value="Student Loan">Student Loan</option>
                      <option value="Mortgage">Mortgage</option>
                      <option value="Personal Loan">Personal Loan</option>
                    </optgroup>
                    <optgroup label="📱 Subscriptions">
                      <option value="Streaming Services">Streaming Services</option>
                      <option value="Software/Apps">Software/Apps</option>
                      <option value="Music">Music</option>
                      <option value="Gaming">Gaming</option>
                      <option value="Cloud Storage">Cloud Storage</option>
                    </optgroup>
                    <optgroup label="🏠 Housing">
                      <option value="Rent">Rent</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Internet/Cable">Internet/Cable</option>
                      <option value="Home Insurance">Home Insurance</option>
                      <option value="HOA Fees">HOA Fees</option>
                    </optgroup>
                    <optgroup label="🚗 Transportation">
                      <option value="Car Payment">Car Payment</option>
                      <option value="Car Insurance">Car Insurance</option>
                      <option value="Gas">Gas</option>
                      <option value="Public Transit">Public Transit</option>
                      <option value="Parking">Parking</option>
                    </optgroup>
                    <optgroup label="🍔 Food & Dining">
                      <option value="Groceries">Groceries</option>
                      <option value="Restaurants">Restaurants</option>
                      <option value="Fast Food">Fast Food</option>
                      <option value="Coffee Shops">Coffee Shops</option>
                    </optgroup>
                    <optgroup label="💰 Income">
                      <option value="Salary">Salary</option>
                      <option value="Freelance">Freelance</option>
                      <option value="Investment Income">Investment Income</option>
                      <option value="Side Hustle">Side Hustle</option>
                      <option value="Bonus">Bonus</option>
                    </optgroup>
                    <optgroup label="🏥 Health">
                      <option value="Health Insurance">Health Insurance</option>
                      <option value="Medical Bills">Medical Bills</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Gym Membership">Gym Membership</option>
                    </optgroup>
                    <optgroup label="🛍️ Shopping">
                      <option value="Clothing">Clothing</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Home Goods">Home Goods</option>
                      <option value="Personal Care">Personal Care</option>
                    </optgroup>
                    <optgroup label="🎉 Entertainment">
                      <option value="Movies/Events">Movies/Events</option>
                      <option value="Hobbies">Hobbies</option>
                      <option value="Travel">Travel</option>
                      <option value="Sports">Sports</option>
                    </optgroup>
                    <optgroup label="📚 Other">
                      <option value="Education">Education</option>
                      <option value="Childcare">Childcare</option>
                      <option value="Pet Care">Pet Care</option>
                      <option value="Gifts/Donations">Gifts/Donations</option>
                      <option value="Taxes">Taxes</option>
                      <option value="Other">Other</option>
                    </optgroup>
                  </select>
                </div>

                {/* Recurring Checkbox */}
                <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <input
                    id="isRecurring"
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 text-yellow-500 focus:ring-2 focus:ring-yellow-500 cursor-pointer"
                  />
                  <label htmlFor="isRecurring" className="text-sm font-medium text-yellow-200 cursor-pointer flex-1">
                    🔄 Recurring Monthly Obligation
                    <span className="block text-xs text-yellow-300/70 mt-1">Check this for monthly bills, loan payments, subscriptions</span>
                  </label>
                </div>

                {/* Remaining Balance (only show if recurring) */}
                {isRecurring && (
                  <div className="space-y-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <label htmlFor="remainingBalance" className="text-sm font-medium text-blue-200">
                      Remaining Balance <span className="text-gray-500 text-xs">(Optional - for loans/debts)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                      <input
                        id="remainingBalance"
                        type="number"
                        value={remainingBalance}
                        onChange={(e) => setRemainingBalance(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-full h-11 pl-8 pr-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-500"
                      />
                    </div>
                    <p className="text-xs text-blue-300/70">Track the total amount you still owe (e.g., car loan balance, credit card balance)</p>

                    {/* Due Date (only show if recurring) */}
                    <div className="space-y-2 mt-3 pt-3 border-t border-blue-500/30">
                      <label htmlFor="dueDate" className="text-sm font-medium text-blue-200">
                        Due Date <span className="text-gray-500 text-xs">(Day of month)</span>
                      </label>
                      <input
                        id="dueDate"
                        type="number"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        placeholder="e.g., 15"
                        min="1"
                        max="31"
                        className="w-full h-11 px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-gray-500"
                      />
                      <p className="text-xs text-blue-300/70">Enter the day of the month when this bill is due (1-31)</p>
                    </div>
                  </div>
                )}

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
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-lg font-medium text-white">{transaction.description}</p>
                          {transaction.isRecurring && (
                            <span className="px-2 py-0.5 bg-yellow-600/30 text-yellow-300 text-xs rounded-md font-medium flex items-center gap-1">
                              🔄 Recurring
                            </span>
                          )}
                        </div>
                        {transaction.category && (
                          <p className="text-sm text-blue-400 mb-1">📁 {transaction.category}</p>
                        )}
                        {transaction.remainingBalance && transaction.remainingBalance > 0 && (
                          <p className="text-sm text-red-400 mb-1">
                            Balance: ${transaction.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
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

      {/* Debt Balance Modal */}
      {showDebtModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Update Total Debt
              </h3>
              <button
                onClick={() => {
                  setShowDebtModal(false)
                  setDebtModalValue('')
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-300 mb-4">
                Enter the new total debt balance. This will proportionally update all your debt transactions.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400 text-lg">$</span>
                <input
                  type="number"
                  value={debtModalValue}
                  onChange={(e) => setDebtModalValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-8 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-lg font-semibold"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateDebtBalance()
                    }
                  }}
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Current total: ${totalDebtBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDebtModal(false)
                  setDebtModalValue('')
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDebtBalance}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Update
              </button>
            </div>
          </div>
        </div>
      )}

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
