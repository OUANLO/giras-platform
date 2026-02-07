'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight, Search, RefreshCw, Download, Loader2 } from 'lucide-react'

// ==================== BUTTON ====================
export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon: Icon, 
  onClick, 
  disabled, 
  loading,
  className = '',
  type = 'button'
}) {
  const variants = {
    primary: 'bg-gradient-to-r from-[#1a365d] to-[#2c5282] text-white hover:shadow-lg hover:shadow-blue-900/20 hover:scale-[1.02]',
    secondary: 'bg-white border-2 border-gray-200 text-gray-700 hover:border-[#1a365d] hover:text-[#1a365d]',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:shadow-lg hover:shadow-red-500/20',
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-emerald-500/20',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${variants[variant]} ${sizes[size]}
        rounded-xl font-medium inline-flex items-center justify-center gap-2
        transition-all duration-300 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${className}
      `}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="animate-spin" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : null}
      {children}
    </button>
  )
}

// ==================== MODAL ====================
export function Modal({ isOpen, onClose, title, children, size = 'md', closeOnClickOutside = true, zIndex = 50 }) {
  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]'
  }

  const handleBackdropClick = () => {
    if (closeOnClickOutside) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" style={{ zIndex }}>
      <div 
        className="fixed inset-0" 
        onClick={handleBackdropClick}
      />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-hidden animate-slide-up`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-5rem)]">
          {children}
        </div>
      </div>
    </div>
  )
}

// ==================== FORM INPUT ====================
export function FormInput({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  required, 
  disabled, 
  options, 
  placeholder, 
  error,
  helperText,
  className = ''
}) {
  const baseClasses = `
    w-full px-4 py-2.5 rounded-xl border text-sm transition-all duration-300
    focus:ring-2 focus:border-transparent
    ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white hover:border-[#1a365d]'}
    ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}
  `

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      {type === 'select' ? (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseClasses}
          required={required}
        >
          {/* Ajouter l'option par défaut seulement si pas d'option vide dans les options */}
          {!options?.some(opt => opt.value === '' || opt.value === null) && (
            <option value="">Sélectionner...</option>
          )}
          {options?.map((opt, i) => (
            <option key={i} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={4}
          className={`${baseClasses} resize-none`}
          required={required}
        />
      ) : type === 'multiselect' ? (
        <div className="space-y-2">
          {options?.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(opt.value)}
                onChange={(e) => {
                  const current = Array.isArray(value) ? value : []
                  if (e.target.checked) {
                    onChange([...current, opt.value])
                  } else {
                    onChange(current.filter(v => v !== opt.value))
                  }
                }}
                disabled={disabled}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={baseClasses}
          required={required}
        />
      )}
      
      {helperText && !error && (
        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}

// ==================== SEARCHABLE SELECT ====================
export function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher...',
  required = false,
  disabled = false,
  multiple = false,
  displayKey = 'label',
  valueKey = 'value',
  className = '',
  error = '',
  size = 'md' // 'sm' pour filtres compacts, 'md' pour formulaires
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Vérifier si le clic est en dehors du container ET du dropdown
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(e.target)
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(e.target)
      
      if (isOutsideContainer && isOutsideDropdown) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Calculer la position du dropdown quand il s'ouvre
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }, [isOpen])

  const filteredOptions = options.filter(opt => {
    const label = typeof opt === 'string' ? opt : (opt[displayKey] || opt.label || '')
    return label.toLowerCase().includes(search.toLowerCase())
  })

  const getOptionValue = (opt) => typeof opt === 'string' ? opt : (opt[valueKey] ?? opt.value)
  const getOptionLabel = (opt) => typeof opt === 'string' ? opt : (opt[displayKey] || opt.label || opt[valueKey] || opt.value)

  const isSelected = (opt) => {
    const optVal = getOptionValue(opt)
    if (multiple) {
      return Array.isArray(value) && value.includes(optVal)
    }
    return value === optVal
  }

  const handleSelect = (opt) => {
    const optVal = getOptionValue(opt)
    if (multiple) {
      const current = Array.isArray(value) ? value : []
      if (current.includes(optVal)) {
        onChange(current.filter(v => v !== optVal))
      } else {
        onChange([...current, optVal])
      }
    } else {
      onChange(optVal)
      setIsOpen(false)
    }
  }

  const removeItem = (val, e) => {
    e.stopPropagation()
    if (multiple && Array.isArray(value)) {
      onChange(value.filter(v => v !== val))
    }
  }

  const getDisplayValue = () => {
    if (multiple) {
      if (!Array.isArray(value) || value.length === 0) return null
      return value.map(v => {
        const opt = options.find(o => getOptionValue(o) === v)
        return opt ? getOptionLabel(opt) : v
      })
    } else {
      if (!value) return null
      const opt = options.find(o => getOptionValue(o) === value)
      return opt ? getOptionLabel(opt) : value
    }
  }

  const displayValue = getDisplayValue()
  
  // Classes conditionnelles selon la taille
  const isCompact = size === 'sm'
  const labelClasses = isCompact 
    ? 'block text-[10px] text-gray-500 mb-0.5' 
    : 'block text-sm font-medium text-gray-700 mb-1'
  const containerClasses = isCompact
    ? `w-full px-2 py-1 rounded border text-xs cursor-pointer flex items-center justify-between gap-1 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-blue-400'} ${error ? 'border-red-300' : 'border-gray-200'} ${isOpen ? 'ring-1 ring-blue-500 border-transparent' : ''}`
    : `w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm cursor-pointer flex items-center justify-between flex-wrap gap-1 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-blue-400'} ${error ? 'border-red-300' : 'border-gray-200'} ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}`

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className={labelClasses}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={containerClasses}
      >
        <div className="flex-1 flex flex-wrap gap-1 items-center min-w-0">
          {multiple && Array.isArray(displayValue) && displayValue.length > 0 ? (
            displayValue.map((label, i) => (
              <span key={i} className={`px-2 py-0.5 bg-blue-100 text-blue-700 rounded ${isCompact ? 'text-[10px]' : 'text-xs'} flex items-center gap-1`}>
                {label}
                <X size={isCompact ? 10 : 12} className="cursor-pointer hover:text-red-600" onClick={(e) => removeItem(value[i], e)} />
              </span>
            ))
          ) : !multiple && displayValue ? (
            <span className={`text-gray-900 truncate ${isCompact ? 'text-xs' : ''}`}>{displayValue}</span>
          ) : (
            <span className={`text-gray-400 ${isCompact ? 'text-xs' : ''}`}>{placeholder}</span>
          )}
        </div>
        <ChevronRight size={isCompact ? 12 : 16} className={`text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
      </div>

      {isOpen && !disabled && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            minWidth: '200px'
          }}
        >
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full pl-8 pr-3 py-1.5 rounded border border-gray-200 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500 text-center">Aucun résultat</div>
            ) : (
              filteredOptions.map((opt, i) => {
                const selected = isSelected(opt)
                return (
                  <div
                    key={i}
                    onClick={() => handleSelect(opt)}
                    className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}
                  >
                    <span className={selected ? 'text-blue-700 font-medium' : 'text-gray-700'}>{getOptionLabel(opt)}</span>
                    {selected && <span className="text-blue-600">✓</span>}
                  </div>
                )
              })
            )}
          </div>
        </div>,
        document.body
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ==================== KPI CARD ====================
export function KPICard({ title, value, subtitle, icon: Icon, color = 'blue', trend, onClick }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    yellow: 'from-amber-500 to-yellow-500'
  }

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 group ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 group-hover:text-[#1a365d] transition-colors">
            {value}
          </p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>
              <span className="text-gray-400">vs période précédente</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color]} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            <Icon size={24} className="text-white" />
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== PROGRESS BAR ====================
export function ProgressBar({ label, value, max, color = 'blue', showDetails = true }) {
  const percentage = max > 0 ? (value / max) * 100 : 0
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    yellow: 'bg-amber-500'
  }

  return (
    <div className="group cursor-pointer hover:bg-gray-50 p-3 rounded-xl transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 group-hover:text-[#1a365d] transition-colors">
          {label}
        </span>
        {showDetails && (
          <span className="text-sm text-gray-500">
            {value}/{max} ({percentage.toFixed(0)}%)
          </span>
        )}
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color]} rounded-full transition-all duration-700 ease-out group-hover:opacity-90`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}

// ==================== STATUS BADGE ====================
export function StatusBadge({ status }) {
  const styles = {
    'Actif': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Inactif': 'bg-gray-100 text-gray-600 border-gray-200',
    'En retard': 'bg-red-100 text-red-700 border-red-200',
    'Pas retard': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Achevée': 'bg-blue-100 text-blue-700 border-blue-200',
    'Non entamée': 'bg-gray-100 text-gray-600 border-gray-200',
    'En cours – moins de 50%': 'bg-orange-100 text-orange-700 border-orange-200',
    'En cours – plus de 50%': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Terminée – non confirmée': 'bg-purple-100 text-purple-700 border-purple-200',
    'Ouvert': 'bg-green-100 text-green-700 border-green-200',
    'Fermé': 'bg-gray-100 text-gray-600 border-gray-200'
  }

  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border whitespace-nowrap ${styles[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  )
}

// ==================== CRITICALITY BADGE ====================
export function CriticalityBadge({ score }) {
  let bgColor, textColor, label
  
  if (score <= 9) {
    bgColor = 'bg-emerald-100'
    textColor = 'text-emerald-700'
    label = 'Faible'
  } else if (score <= 18) {
    bgColor = 'bg-yellow-100'
    textColor = 'text-yellow-700'
    label = 'Modéré'
  } else if (score <= 36) {
    bgColor = 'bg-orange-100'
    textColor = 'text-orange-700'
    label = 'Significatif'
  } else {
    bgColor = 'bg-red-100'
    textColor = 'text-red-700'
    label = 'Critique'
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${bgColor}`}>
      <span className={`text-sm font-bold ${textColor}`}>{score}</span>
      <span className={`text-xs ${textColor}`}>{label}</span>
    </div>
  )
}

// ==================== FILTER BAR ====================
export function FilterBar({ filters, values, onChange, onReset, onExport }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
      <div className="flex flex-wrap items-end gap-4">
        {filters.map((filter, i) => (
          <div key={i} className="flex-1 min-w-[160px] max-w-[240px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {filter.label}
            </label>
            {filter.type === 'select' ? (
              <select
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">Tous</option>
                {filter.options?.map((opt, j) => (
                  <option key={j} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : filter.type === 'search' ? (
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={values[filter.key] || ''}
                  onChange={(e) => onChange(filter.key, e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            ) : (
              <input
                type={filter.type}
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            )}
          </div>
        ))}
        
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Reset
          </button>
          {onExport && (
            <button
              onClick={onExport}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2"
            >
              <Download size={14} />
              Export
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== SIDEBAR BUTTON ====================
export function SidebarButton({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group ${
        active
          ? 'bg-gradient-to-r from-[#1a365d] to-[#2c5282] text-white shadow-lg'
          : 'text-gray-600 hover:bg-gray-50 hover:text-[#1a365d]'
      }`}
    >
      <div className={`p-2 rounded-lg transition-all duration-300 ${
        active ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-[#1a365d]/10'
      }`}>
        <Icon size={18} className={active ? 'text-white' : 'text-[#1a365d]'} />
      </div>
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
        }`}>
          {badge}
        </span>
      )}
      <ChevronRight size={16} className={`transition-transform duration-300 ${
        active ? 'rotate-90' : 'group-hover:translate-x-1'
      }`} />
    </button>
  )
}

// ==================== DATA TABLE ====================
export function DataTable({ columns, data, actions, onRowClick, loading, emptyMessage = 'Aucune donnée disponible', compact = false, minWidth = '1200px' }) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-center">
        <Loader2 size={32} className="mx-auto mb-3 text-gray-400 animate-spin" />
        <p className="text-[10px] text-gray-500">Chargement des données...</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-[10px] text-gray-500">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]" style={{ minWidth: minWidth }}>
          <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]">
            <tr>
              {columns.map((col, i) => (
                <th 
                  key={i} 
                  className={`px-2 py-2 text-left text-white whitespace-nowrap ${col.className || ''}`}
                  style={col.width ? { width: col.width, minWidth: col.width } : { minWidth: '80px' }}
                >
                  {col.label}
                </th>
              ))}
              {actions && (
                <th className="px-2 py-2 text-center text-white sticky right-0 bg-[#2c5282]" style={{ minWidth: '80px' }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                onClick={() => onRowClick?.(row)}
                className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col, colIndex) => (
                  <td 
                    key={colIndex} 
                    className={`px-2 py-1.5 text-gray-700 ${col.tdClassName || ''}`}
                  >
                    {col.render ? col.render(row[col.key], row) : (row[col.key] || '-')}
                  </td>
                ))}
                {actions && (
                  <td className="px-2 py-1.5 sticky right-0 bg-white">
                    <div className="flex items-center justify-center gap-1">
                      {actions.map((action, i) => (
                        <button
                          key={i}
                          onClick={(e) => { e.stopPropagation(); action.onClick(row); }}
                          title={action.label}
                          className={`p-1 rounded hover:scale-110 ${
                            action.className || 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          <action.icon size={12} />
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">
        Total: {data.length}
      </div>
    </div>
  )
}

// ==================== LOADING SPINNER ====================
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4'
  }

  return (
    <div className={`${sizes[size]} border-gray-300 border-t-blue-600 rounded-full animate-spin ${className}`} />
  )
}

// ==================== EMPTY STATE ====================
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-12">
      {Icon && (
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon size={32} className="text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-gray-500 mb-4">{description}</p>}
      {action}
    </div>
  )
}

// ==================== ALERT MODAL (Succès, Erreur, Info, Confirmation) ====================
import { CheckCircle, AlertTriangle, Info, XCircle, AlertCircle } from 'lucide-react'

export function AlertModal({ isOpen, onClose, type = 'success', title, message, onConfirm, confirmText = 'OK', cancelText = 'Annuler', showCancel = false }) {
  if (!isOpen) return null

  const configs = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
      title: title || 'Succès'
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-100',
      iconColor: 'text-red-600',
      title: title || 'Erreur'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-orange-100',
      iconColor: 'text-orange-600',
      title: title || 'Attention'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      title: title || 'Information'
    },
    confirm: {
      icon: AlertCircle,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      title: title || 'Confirmation'
    }
  }

  const config = configs[type] || configs.info
  const IconComponent = config.icon

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl animate-slide-up">
        <div className="flex flex-col items-center text-center">
          <div className={`w-12 h-12 ${config.bgColor} rounded-full flex items-center justify-center mb-4`}>
            <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{config.title}</h3>
          <p className="text-gray-600 mb-4">{message}</p>
          <div className="flex gap-3">
            {(showCancel || type === 'confirm') && (
              <Button variant="secondary" onClick={onClose}>{cancelText}</Button>
            )}
            <Button onClick={handleConfirm}>{confirmText}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== HOOK useAlert pour utilisation simplifiée ====================
export function useAlert() {
  const [alertState, setAlertState] = useState({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null,
    showCancel: false
  })

  const showAlert = (type, message, options = {}) => {
    setAlertState({
      isOpen: true,
      type,
      message,
      title: options.title || '',
      onConfirm: options.onConfirm || null,
      showCancel: options.showCancel || false
    })
  }

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, isOpen: false }))
  }

  const success = (message, options) => showAlert('success', message, options)
  const error = (message, options) => showAlert('error', message, options)
  const warning = (message, options) => showAlert('warning', message, options)
  const info = (message, options) => showAlert('info', message, options)
  const confirm = (message, onConfirm, options = {}) => showAlert('confirm', message, { ...options, onConfirm, showCancel: true })

  return {
    alertState,
    closeAlert,
    success,
    error,
    warning,
    info,
    confirm,
    AlertComponent: () => (
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onConfirm={alertState.onConfirm}
        showCancel={alertState.showCancel}
      />
    )
  }
}
