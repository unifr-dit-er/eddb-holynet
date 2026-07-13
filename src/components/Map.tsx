import { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { Bug, X, Funnel, ArrowCounterClockwise, Crosshair, Image, MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { marked } from 'marked'
import { toast } from 'sonner'
import { config, type PropertyConfig } from '@/config'
import { getValueFromPath } from '@/lib/utils'

interface ImageData {
  signedPath?: string
}

interface ApiRecord {
  Id: number
  [key: string]: any
}

interface ApiResponse {
  list: ApiRecord[]
  pageInfo: {
    totalRows?: number
  }
}

interface MapProps {
  onPointCountChange?: (count: number) => void
}

interface FilterState {
  values: string[]
  counts: Record<string, number>
  selected: Set<string>
}

const imageCache = new globalThis.Map<string, string>()
const DEFAULT_MARKER_COLOR = 'oklch(0.45 0.15 250)'
const MARKER_CENTER_COLOR = 'oklch(0.98 0 0)'
const UNKNOWN_MARKER_COLOR = 'hsl(220 8% 45%)'
const DEFAULT_COLOR_CATEGORY = '__default__'
const GOLDEN_ANGLE = 137.508
const FIELD_OPTION_ORDER: Record<string, string[]> = {
  TimeOfEmergence: [
    'Pre-Roman (before 4 BCE)',
    'Roman (before 326 CE)',
    'Byzantine (326-638)',
    'Early Islamic (638-1099)',
    'Crusader (1099-1187)',
    'Ayyubid (1187-1250)',
    'Mamluk (1250-1517)',
    'Ottoman (1517-1917)'
  ]
}
const CHRONOLOGICAL_FILTER_FIELDS = new Set(Object.keys(FIELD_OPTION_ORDER))

function getPropertyLabel(field: string): string {
  const property = config.properties.find(p => p.field === field)
  return property?.label || field
}

function getFilterValueLabel(field: string, value: string): string {
  if (value === 'Unknown' && !CHRONOLOGICAL_FILTER_FIELDS.has(field)) {
    return 'Other'
  }
  return value
}

async function cacheImage(signedPath: string): Promise<string> {
  if (imageCache.has(signedPath)) {
    return imageCache.get(signedPath)!
  }

  try {
    const fullUrl = `${config.eddbServiceUrl}/noco/${signedPath}`
    const response = await fetch(fullUrl)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    imageCache.set(signedPath, objectUrl)
    return objectUrl
  } catch (error) {
    if (config.debug.showConsoleLog) {
      console.error('Error caching image:', error)
    }
    return `${config.eddbServiceUrl}/noco/${signedPath}`
  }
}

function parseMarkdown(text: string): string {
  try {
    const parsed = marked.parse(text, { async: false }) as string
    return parsed.replace(/<p>(.*?)<\/p>/g, '$1').trim()
  } catch {
    return text
  }
}

function getPropertyValue(record: any, property: PropertyConfig): string[] {
  if (property.path) {
    const values = getValueFromPath(record, property.path)
    return values.filter(v => v !== null && v !== undefined && v !== '').map(v => String(v))
  }
  
  const value = record[property.field]
  if (value === null || value === undefined || value === '') {
    return []
  }
  
  if (Array.isArray(value)) {
    return value.filter(v => v !== null && v !== undefined && v !== '').map(v => String(v))
  }
  
  return [String(value)]
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function generateDistinctColor(index: number, seed: number): string {
  const hue = (seed % 360 + index * GOLDEN_ANGLE) % 360
  const saturation = 72 - (index % 3) * 8
  const lightness = 45 + (Math.floor(index / 3) % 2) * 8
  return `hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`
}

function createMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        border: 3px solid ${MARKER_CENTER_COLOR};
        border-radius: 50% 50% 50% 0;
        width: 28px;
        height: 28px;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 10px;
          height: 10px;
          background-color: ${MARKER_CENTER_COLOR};
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  })
}

function getMarkerColorCategory(record: ApiRecord, colorProperty: PropertyConfig | null): string {
  if (!colorProperty) {
    return DEFAULT_COLOR_CATEGORY
  }

  const values = getPropertyValue(record, colorProperty)
  if (values.length === 0) {
    return 'Unknown'
  }

  return values[0]
}

function buildMarkerColorMap(records: ApiRecord[], colorProperty: PropertyConfig | null): Map<string, string> {
  const colorMap = new globalThis.Map<string, string>()
  colorMap.set(DEFAULT_COLOR_CATEGORY, DEFAULT_MARKER_COLOR)

  if (!colorProperty || records.length === 0) {
    return colorMap
  }

  const categorySet = new Set<string>()
  records.forEach(record => {
    categorySet.add(getMarkerColorCategory(record, colorProperty))
  })

  const categories = Array.from(categorySet)
    .filter(category => category !== 'Unknown')
    .sort((a, b) => a.localeCompare(b))

  const seed = hashString(`${colorProperty.field}|${categories.join('|')}`)
  categories.forEach((category, index) => {
    colorMap.set(category, generateDistinctColor(index, seed))
  })

  if (categorySet.has('Unknown')) {
    colorMap.set('Unknown', UNKNOWN_MARKER_COLOR)
  }

  return colorMap
}

export function Map({ onPointCountChange }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiData, setApiData] = useState<ApiRecord[] | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  
  const [filterStates, setFilterStates] = useState<Record<string, FilterState>>({})
  const [booleanFilterStates, setBooleanFilterStates] = useState<Record<string, boolean>>({})
  
  const markerLayerGroup = useRef<L.MarkerClusterGroup | L.FeatureGroup<L.Marker> | null>(null)
  const markerMapRef = useRef(new globalThis.Map<number, L.Marker>())
  const [clustersEnabled, setClustersEnabled] = useState(true)
  const [showOpenById, setShowOpenById] = useState(false)
  const [inputId, setInputId] = useState('')
  const [showSearchByDenomination, setShowSearchByDenomination] = useState(false)
  const [searchDenomination, setSearchDenomination] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<string>('')

  const createMarkerLayerGroup = (useClusters: boolean): L.MarkerClusterGroup | L.FeatureGroup<L.Marker> => {
    if (useClusters) {
      return L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: config.map.clusterRadius,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
      })
    }

    return L.featureGroup<L.Marker>()
  }

  const standardFilterProperties = useMemo(() => 
    config.properties.filter(p => p.filter && p.filter.type === 'standard'), 
    []
  )
  const booleanFilterProperties = useMemo(() => 
    config.properties.filter(p => p.filter && p.filter.type === 'boolean'), 
    []
  )
  const displayProperties = useMemo(() => 
    config.properties.filter(p => p.filter === null || p.filter.type === 'standard'), 
    []
  )
  const colorProperty = useMemo<PropertyConfig | null>(() => {
    const colorField = config.map.markerColors?.field
    if (!colorField) {
      return null
    }

    return config.properties.find(property => property.field === colorField) || {
      field: colorField,
      filter: null
    }
  }, [])
  const markerColorsByCategory = useMemo(() => {
    if (!apiData) {
      return buildMarkerColorMap([], colorProperty)
    }
    return buildMarkerColorMap(apiData, colorProperty)
  }, [apiData, colorProperty])

  useEffect(() => {
    if (standardFilterProperties.length > 0 && !selectedFilter) {
      setSelectedFilter(standardFilterProperties[0].field)
    }
  }, [standardFilterProperties, selectedFilter])

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return

    const map = L.map(mapContainer.current, { maxZoom: 22 }).setView(config.map.defaultCenter as [number, number], config.map.defaultZoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxNativeZoom: 19,
      maxZoom: 22
    }).addTo(map)

    mapInstance.current = map

    const fetchData = async () => {
      try {
        setLoading(true)
        
        let allRecords: ApiRecord[] = []
        let offset = 0
        const limit = 1000
        
        while (true) {
          const response = await fetch(
            `${config.apiUrl}?limit=${limit}&offset=${offset}`,
            {
              headers: {
                'xc-token': config.apiToken
              }
            }
          )

          if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status}`)
          }

          const data: ApiResponse = await response.json()
          
          if (!data.list || data.list.length === 0) {
            break
          }
          
          allRecords = allRecords.concat(data.list)
          
          if (data.list.length < limit) {
            break
          }
          
          offset += limit
        }

        if (config.popup.imageLinkedTable && config.popup.imageField) {
          const { apiUrl, attachmentField, foreignKey } = config.popup.imageLinkedTable
          const imageField = config.popup.imageField
          let visualRecords: any[] = []
          let visualOffset = 0

          while (true) {
            const visualResponse = await fetch(
              `${apiUrl}?limit=${limit}&offset=${visualOffset}`,
              { headers: { 'xc-token': config.apiToken } }
            )
            if (!visualResponse.ok) break
            const visualData = await visualResponse.json()
            if (!visualData.list || visualData.list.length === 0) break
            visualRecords = visualRecords.concat(visualData.list)
            if (visualData.list.length < limit) break
            visualOffset += limit
          }

          const visualsByParent = new globalThis.Map<number, any[]>()
          for (const v of visualRecords) {
            const parentId = v[foreignKey]
            if (parentId != null) {
              if (!visualsByParent.has(parentId)) visualsByParent.set(parentId, [])
              visualsByParent.get(parentId)!.push({ [attachmentField]: v[attachmentField] ?? [] })
            }
          }

          for (const record of allRecords) {
            record[imageField] = visualsByParent.get(record.Id) ?? []
          }

          if (config.debug.showConsoleLog) {
            console.log(`Loaded ${visualRecords.length} visual records`)
          }
        }

        setApiData(allRecords)

        const newFilterStates: Record<string, FilterState> = {}
        
        standardFilterProperties.forEach(property => {
          const countMap: Record<string, number> = {}

          allRecords.forEach(record => {
            if (record[config.geoDataField] && typeof record[config.geoDataField] === 'string') {
              const parts = record[config.geoDataField].split(';')
              if (parts.length === 2) {
                const lat = parseFloat(parts[0])
                const lng = parseFloat(parts[1])

                if (!isNaN(lat) && !isNaN(lng)) {
                  const values = getPropertyValue(record, property)

                  if (values.length === 0) {
                    countMap['Unknown'] = (countMap['Unknown'] || 0) + 1
                  } else {
                    values.forEach(value => {
                      countMap[value] = (countMap[value] || 0) + 1
                    })
                  }
                }
              }
            }
          })

          const fixedOrder = FIELD_OPTION_ORDER[property.field]
          const uniqueValues = fixedOrder
            ? fixedOrder.filter(v => countMap[v])
            : Object.keys(countMap).filter(v => v !== 'Unknown').sort()
          const valuesWithUnknown = countMap['Unknown']
            ? [...uniqueValues, 'Unknown']
            : uniqueValues
          
          newFilterStates[property.field] = {
            values: valuesWithUnknown,
            counts: countMap,
            selected: new Set(valuesWithUnknown)
          }
        })
        
        setFilterStates(newFilterStates)
        
        const newBooleanFilterStates: Record<string, boolean> = {}
        booleanFilterProperties.forEach(property => {
          newBooleanFilterStates[property.field] = false
        })
        setBooleanFilterStates(newBooleanFilterStates)
        
        if (config.debug.showConsoleLog) {
          console.log(`Loaded ${allRecords.length} records`)
        }

        setLoading(false)
      } catch (err) {
        if (config.debug.showConsoleLog) {
          console.error('Error fetching map data:', err)
        }
        setError(err instanceof Error ? err.message : 'Failed to load map data')
        setLoading(false)
      }
    }

    fetchData()

    return () => {
      map.remove()
      mapInstance.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapInstance.current || !apiData) return

    if (markerLayerGroup.current) {
      mapInstance.current.removeLayer(markerLayerGroup.current)
    }

    const markerLayer = createMarkerLayerGroup(clustersEnabled)
    markerLayerGroup.current = markerLayer
    markerMapRef.current.clear()

    let validPoints = 0
    apiData.forEach(record => {
      for (const property of standardFilterProperties) {
        const values = getPropertyValue(record, property)
        
        if (values.length === 0) {
          if (!filterStates[property.field]?.selected.has('Unknown')) {
            return
          }
        } else {
          let hasMatch = false
          for (const value of values) {
            if (filterStates[property.field]?.selected.has(value)) {
              hasMatch = true
              break
            }
          }
          if (!hasMatch) {
            return
          }
        }
      }
      
      for (const property of booleanFilterProperties) {
        if (booleanFilterStates[property.field]) {
          const checkFunc = property.filter?.type === 'boolean' ? property.filter.checkFunction : undefined
          const defaultCheck = (rec: any) => !!rec[property.field]
          const finalCheck = checkFunc || defaultCheck
          if (!finalCheck(record)) {
            return
          }
        }
      }

      if (record[config.geoDataField] && typeof record[config.geoDataField] === 'string') {
        const parts = record[config.geoDataField].split(';')
        if (parts.length === 2) {
          const lat = parseFloat(parts[0])
          const lng = parseFloat(parts[1])
          
          if (!isNaN(lat) && !isNaN(lng)) {
            const markerCategory = getMarkerColorCategory(record, colorProperty)
            const markerColor = markerColorsByCategory.get(markerCategory)
              || markerColorsByCategory.get('Unknown')
              || DEFAULT_MARKER_COLOR
            const marker = L.marker([lat, lng], { icon: createMarkerIcon(markerColor) })
            
            const title = record[config.popup.titleField] || 'Untitled'
            
            const locations = [
              record.Location1,
              record.Location2,
              record.Location3
            ].filter(loc => loc !== null && loc !== undefined && loc !== '').join(', ')
            
            const popupContent = displayProperties
              .map(property => {
                const values = getPropertyValue(record, property)
                if (values.length > 0) {
                  const label = getPropertyLabel(property.field)
                  if (property.field === 'PleiadesId') {
                    const pleiadesUrl = `https://pleiades.stoa.org/places/${values[0]}`
                    return `<p><strong>${label}:</strong> <a href="${pleiadesUrl}" target="_blank" rel="noopener noreferrer" style="color: oklch(0.45 0.15 250); text-decoration: underline;">${values[0]}</a></p>`
                  }
                  const displayValue = values.map(v => parseMarkdown(String(v))).join(', ')
                  return `<p><strong>${label}:</strong> ${displayValue}</p>`
                }
                return ''
              })
              .filter(Boolean)
              .join('')
            
            const locationsHtml = locations ? `<p><strong>Locations:</strong> ${locations}</p>` : ''
            
            const popupElement = document.createElement('div')
            popupElement.innerHTML = `<div><h3>${title}</h3>${locationsHtml}${popupContent}</div>`
            
            if (config.popup.imageField && record[config.popup.imageField] && Array.isArray(record[config.popup.imageField]) && record[config.popup.imageField].length > 0) {
              const fieldData = record[config.popup.imageField]
              const images: ImageData[] = []
              for (const item of fieldData) {
                if (item.signedPath) {
                  images.push(item)
                } else if (item.Attachment && Array.isArray(item.Attachment)) {
                  for (const att of item.Attachment) {
                    if (att.signedPath) images.push(att)
                  }
                }
              }

              const imageContainer = document.createElement('div')
              imageContainer.style.marginTop = '12px'
              imageContainer.style.display = 'flex'
              imageContainer.style.gap = '8px'
              imageContainer.style.flexWrap = 'wrap'

              images.forEach((img: ImageData) => {
                if (img.signedPath) {
                  const imgWrapper = document.createElement('div')
                  imgWrapper.style.width = '120px'
                  imgWrapper.style.height = '120px'
                  imgWrapper.style.borderRadius = 'var(--radius)'
                  imgWrapper.style.overflow = 'hidden'
                  imgWrapper.style.cursor = 'pointer'
                  imgWrapper.style.border = '2px solid oklch(0.88 0.01 250)'
                  imgWrapper.style.transition = 'transform 0.2s'
                  
                  imgWrapper.addEventListener('mouseenter', () => {
                    imgWrapper.style.transform = 'scale(1.05)'
                  })
                  imgWrapper.addEventListener('mouseleave', () => {
                    imgWrapper.style.transform = 'scale(1)'
                  })
                  
                  const imgElement = document.createElement('img')
                  imgElement.style.width = '100%'
                  imgElement.style.height = '100%'
                  imgElement.style.objectFit = 'cover'
                  imgElement.alt = 'Point image'
                  
                  cacheImage(img.signedPath).then(url => {
                    imgElement.src = url
                  })
                  
                  imgWrapper.addEventListener('click', () => {
                    cacheImage(img.signedPath!).then(url => {
                      window.open(url, '_blank')
                    })
                  })
                  
                  imgWrapper.appendChild(imgElement)
                  imageContainer.appendChild(imgWrapper)
                }
              })
              
              popupElement.appendChild(imageContainer)
            }

            marker.bindPopup(popupElement, {
              maxWidth: config.popup.width || 300
            })

            markerLayer.addLayer(marker)
            markerMapRef.current.set(record.Id, marker)
            validPoints++
          }
        }
      }
    })

    mapInstance.current.addLayer(markerLayer)

    if (validPoints > 0 && markerLayer.getBounds().isValid()) {
      mapInstance.current.fitBounds(markerLayer.getBounds(), { padding: [50, 50] })
    }

    onPointCountChange?.(validPoints)
  }, [
    filterStates,
    booleanFilterStates,
    apiData,
    onPointCountChange,
    standardFilterProperties,
    booleanFilterProperties,
    displayProperties,
    colorProperty,
    markerColorsByCategory,
    clustersEnabled
  ])

  const handleFilterToggle = (field: string, value: string) => {
    setFilterStates(prev => {
      const current = prev[field]
      if (!current) return prev
      
      const newSelected = new Set(current.selected)
      if (newSelected.has(value)) {
        newSelected.delete(value)
      } else {
        newSelected.add(value)
      }
      
      return {
        ...prev,
        [field]: {
          ...current,
          selected: newSelected
        }
      }
    })
  }

  const handleSelectAll = (field: string) => {
    setFilterStates(prev => {
      const current = prev[field]
      if (!current) return prev
      
      return {
        ...prev,
        [field]: {
          ...current,
          selected: new Set(current.values)
        }
      }
    })
  }

  const handleDeselectAll = (field: string) => {
    setFilterStates(prev => {
      const current = prev[field]
      if (!current) return prev
      
      return {
        ...prev,
        [field]: {
          ...current,
          selected: new Set()
        }
      }
    })
  }

  const handleBooleanFilterToggle = (field: string) => {
    setBooleanFilterStates(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleResetAllFilters = () => {
    setFilterStates(prev => {
      const newState: Record<string, FilterState> = {}
      Object.keys(prev).forEach(field => {
        newState[field] = {
          ...prev[field],
          selected: new Set(prev[field].values)
        }
      })
      return newState
    })
    
    setBooleanFilterStates(prev => {
      const newState: Record<string, boolean> = {}
      Object.keys(prev).forEach(field => {
        newState[field] = false
      })
      return newState
    })
  }

  const denominationSearchResults = useMemo(() => {
    const query = searchDenomination.trim().toLowerCase()
    if (!query || !apiData) return []
    return apiData
      .filter(record => {
        const denomination = record[config.popup.titleField]
        return denomination && String(denomination).toLowerCase().includes(query)
      })
      .slice(0, 50)
  }, [searchDenomination, apiData])

  const openMarkerOnMap = (marker: L.Marker) => {
    if (!mapInstance.current) return
    const layer = markerLayerGroup.current
    if (layer && 'zoomToShowLayer' in layer) {
      (layer as L.MarkerClusterGroup).zoomToShowLayer(marker, () => marker.openPopup())
    } else {
      mapInstance.current.setView(marker.getLatLng(), 18)
      marker.openPopup()
    }
  }

  const handleSelectDenominationResult = (recordId: number) => {
    const marker = markerMapRef.current.get(recordId)
    if (!marker) return
    openMarkerOnMap(marker)
    setShowSearchByDenomination(false)
    setSearchDenomination('')
  }

  const handleOpenById = () => {
    const id = parseInt(inputId.trim())
    
    if (isNaN(id)) {
      toast.error('Please enter a valid numeric ID')
      return
    }

    const marker = markerMapRef.current.get(id)
    
    if (!marker) {
      toast.error(`No point found with ID: ${id}`)
      return
    }

    if (mapInstance.current) {
      openMarkerOnMap(marker)
      setShowOpenById(false)
      setInputId('')
      toast.success(`Opened point with ID: ${id}`)
    }
  }

  const hasFilters = standardFilterProperties.length > 0 || booleanFilterProperties.length > 0

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapContainer} 
        className="w-full h-full"
      />
      
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
          <Label htmlFor="clusters-toggle" className="text-xs font-medium cursor-pointer">
            Clusters
          </Label>
          <Switch
            id="clusters-toggle"
            checked={clustersEnabled}
            onCheckedChange={setClustersEnabled}
          />
        </div>

        <Dialog open={showOpenById} onOpenChange={setShowOpenById}>
          <DialogTrigger asChild>
            <Button
              className="shadow-lg"
              size="sm"
              variant="secondary"
            >
              <Crosshair size={18} weight="fill" className="mr-2" />
              Open by ID
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open Point by ID</DialogTitle>
              <DialogDescription>
                Enter the ID of a point to locate and open it on the map.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="point-id">Point ID</Label>
                <Input
                  id="point-id"
                  type="number"
                  placeholder="Enter point ID..."
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleOpenById()
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowOpenById(false)
                    setInputId('')
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleOpenById}>
                  Open Point
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showSearchByDenomination} onOpenChange={(open) => {
          setShowSearchByDenomination(open)
          if (!open) setSearchDenomination('')
        }}>
          <DialogTrigger asChild>
            <Button
              className="shadow-lg"
              size="sm"
              variant="secondary"
            >
              <MagnifyingGlass size={18} weight="fill" className="mr-2" />
              Search
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Search by {config.popup.titleField}</DialogTitle>
              <DialogDescription>
                Enter a name to find matching sites on the map.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                autoFocus
                placeholder={`Search ${config.popup.titleField}...`}
                value={searchDenomination}
                onChange={(e) => setSearchDenomination(e.target.value)}
              />
              {searchDenomination.trim() && (
                <div className="border border-border rounded-md overflow-auto max-h-64">
                  {denominationSearchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-3 py-2">No results found.</p>
                  ) : (
                    <ul>
                      {denominationSearchResults.map(record => (
                        <li key={record.Id}>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                            onClick={() => handleSelectDenominationResult(record.Id)}
                          >
                            {record[config.popup.titleField]}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {hasFilters && (
          <Button
            onClick={() => setShowFilter(!showFilter)}
            className="shadow-lg"
            size="sm"
            variant={showFilter ? "default" : "secondary"}
          >
            <Funnel size={18} weight="fill" className="mr-2" />
            Filter
          </Button>
        )}
        
        {config.debug.enabled && (
          <Button
            onClick={() => setShowDebug(!showDebug)}
            className="shadow-lg"
            size="sm"
            variant={showDebug ? "default" : "secondary"}
          >
            <Bug size={18} weight="fill" className="mr-2" />
            Debug
          </Button>
        )}
      </div>

      {showFilter && hasFilters && (
        <div className="absolute top-16 right-4 w-96 bg-card border border-border rounded-lg shadow-xl z-[1001]" style={{ maxHeight: 'calc(100vh - 10rem)', overflow: 'auto' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
            <div className="flex items-center gap-2">
              <Funnel size={20} weight="fill" className="text-primary" />
              <h3 className="font-semibold text-sm">Filters</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleResetAllFilters}
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
              >
                <ArrowCounterClockwise size={16} className="mr-1" />
                Reset all
              </Button>
              <Button
                onClick={() => setShowFilter(false)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <X size={18} />
              </Button>
            </div>
          </div>

          {booleanFilterProperties.length > 0 && (
            <div className="border-b border-border">
              {booleanFilterProperties.map(property => (
                <div key={property.field} className="px-4 py-3 border-b border-border bg-muted/50 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image size={18} weight="fill" className="text-primary" />
                      <Label htmlFor={`filter-${property.field}`} className="text-sm font-medium cursor-pointer">
                        {getPropertyLabel(property.field)}
                      </Label>
                    </div>
                    <Switch
                      id={`filter-${property.field}`}
                      checked={booleanFilterStates[property.field] || false}
                      onCheckedChange={() => handleBooleanFilterToggle(property.field)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {standardFilterProperties.length > 0 && config.filterMenu.type === 'dropdown' && (
            <div className="flex flex-col">
              <div className="px-4 pt-3 pb-3 sticky top-[57px] bg-card z-10 border-b border-border">
                <Label htmlFor="filter-select" className="text-xs text-muted-foreground mb-2 block">
                  Select Filter
                </Label>
                <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                  <SelectTrigger id="filter-select" className="w-full">
                    <SelectValue placeholder="Choose a filter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {standardFilterProperties.map(property => {
                      const state = filterStates[property.field]
                      const activeCount = state ? state.selected.size : 0
                      const totalCount = state ? state.values.length : 0
                      const isPartiallyFiltered = state && activeCount < totalCount && activeCount > 0
                      const isFullyFiltered = state && activeCount === 0
                      
                      return (
                        <SelectItem key={property.field} value={property.field}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{getPropertyLabel(property.field)}</span>
                            <span className={`text-xs font-medium ${
                              isFullyFiltered ? 'text-destructive' : 
                              isPartiallyFiltered ? 'text-primary' : 
                              'text-muted-foreground'
                            }`}>
                              {activeCount}/{totalCount}
                            </span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              {standardFilterProperties.map(property => {
                const state = filterStates[property.field]
                if (!state || selectedFilter !== property.field) return null
                const isColorFilter = colorProperty?.field === property.field
                
                return (
                  <div key={property.field}>
                    <div className="px-4 py-2 border-b border-border bg-muted flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Selected: <span className="font-semibold text-foreground">{state.selected.size}</span> of <span className="font-semibold text-foreground">{state.values.length}</span>
                      </p>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => handleSelectAll(property.field)}
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                        >
                          All
                        </Button>
                        <Button
                          onClick={() => handleDeselectAll(property.field)}
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                        >
                          None
                        </Button>
                      </div>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                      {state.values.map(value => {
                        const color = markerColorsByCategory.get(value)
                          || markerColorsByCategory.get('Unknown')
                          || DEFAULT_MARKER_COLOR

                        return (
                          <div key={value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${property.field}-${value}`}
                              checked={state.selected.has(value)}
                              onCheckedChange={() => handleFilterToggle(property.field, value)}
                            />
                            {isColorFilter && (
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
                                style={{ backgroundColor: color }}
                              />
                            )}
                            <Label
                              htmlFor={`${property.field}-${value}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {getFilterValueLabel(property.field, value)}
                            </Label>
                            <span className="text-xs text-muted-foreground font-medium">
                              {state.counts[value] || 0}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {standardFilterProperties.length > 0 && config.filterMenu.type === 'tabs' && (
            <Tabs value={selectedFilter} onValueChange={setSelectedFilter} className="w-full">
              <div className="px-4 pt-3 pb-3 sticky top-[57px] bg-card z-10 border-b border-border">
                <TabsList className="w-full h-auto grid gap-1" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(100px, 1fr))` }}>
                  {standardFilterProperties.map(property => {
                    const state = filterStates[property.field]
                    const activeCount = state ? state.selected.size : 0
                    const totalCount = state ? state.values.length : 0
                    const isPartiallyFiltered = state && activeCount < totalCount && activeCount > 0
                    const isFullyFiltered = state && activeCount === 0
                    const label = property.filter?.type === 'standard' && property.filter.shortLabel 
                      ? property.filter.shortLabel 
                      : getPropertyLabel(property.field)
                    
                    return (
                      <TabsTrigger 
                        key={property.field} 
                        value={property.field}
                        className="text-xs px-2 py-1.5 relative"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="truncate max-w-full">{label}</span>
                          <span className={`text-[10px] font-bold ${
                            isFullyFiltered ? 'text-destructive' : 
                            isPartiallyFiltered ? 'text-primary' : 
                            'text-muted-foreground'
                          }`}>
                            {activeCount}/{totalCount}
                          </span>
                        </div>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>
              
              {standardFilterProperties.map(property => {
                const state = filterStates[property.field]
                if (!state) return null
                const isColorFilter = colorProperty?.field === property.field
                
                return (
                  <TabsContent key={property.field} value={property.field} className="mt-0">
                    <div className="px-4 py-2 border-b border-border bg-muted flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Selected: <span className="font-semibold text-foreground">{state.selected.size}</span> of <span className="font-semibold text-foreground">{state.values.length}</span>
                      </p>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => handleSelectAll(property.field)}
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                        >
                          All
                        </Button>
                        <Button
                          onClick={() => handleDeselectAll(property.field)}
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                        >
                          None
                        </Button>
                      </div>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                      {state.values.map(value => {
                        const color = markerColorsByCategory.get(value)
                          || markerColorsByCategory.get('Unknown')
                          || DEFAULT_MARKER_COLOR

                        return (
                          <div key={value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${property.field}-${value}`}
                              checked={state.selected.has(value)}
                              onCheckedChange={() => handleFilterToggle(property.field, value)}
                            />
                            {isColorFilter && (
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
                                style={{ backgroundColor: color }}
                              />
                            )}
                            <Label
                              htmlFor={`${property.field}-${value}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {getFilterValueLabel(property.field, value)}
                            </Label>
                            <span className="text-xs text-muted-foreground font-medium">
                              {state.counts[value] || 0}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </div>
      )}

      {showDebug && apiData && (
        <div className="absolute top-16 right-4 bottom-4 w-96 bg-card border border-border rounded-lg shadow-xl z-[1001] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Bug size={20} weight="fill" className="text-primary" />
              <h3 className="font-semibold text-sm">API Response Debug</h3>
            </div>
            <Button
              onClick={() => setShowDebug(false)}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <X size={18} />
            </Button>
          </div>
          
          <div className="px-4 py-2 border-b border-border bg-muted shrink-0">
            <p className="text-xs text-muted-foreground">
              Total Records: <span className="font-semibold text-foreground">{apiData.length}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              With Coordinates: <span className="font-semibold text-foreground">
                {apiData.filter(r => r[config.geoDataField] && typeof r[config.geoDataField] === 'string' && r[config.geoDataField].includes(';')).length}
              </span>
            </p>
          </div>

          <div className="flex-1 overflow-auto px-4 py-3">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words">
              {JSON.stringify(apiData, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      {loading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-[1000]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading map data...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg z-[1000]">
          {error}
        </div>
      )}
    </div>
  )
}
