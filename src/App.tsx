import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Search, Heart, Send, Sparkles, 
  User, Instagram, Compass, ShoppingBag, MessageCircle, Globe, Palette, Settings,
  Cloud, Star, ChevronLeft, ChevronRight, Plus, Trash2, Eye, EyeOff, Download, Check, X, ChevronDown
} from 'lucide-react';
import Dexie, { Table } from 'dexie';

// IndexedDB Helper using Dexie
export class LunaDB extends Dexie {
  store!: Table<any, string>;
  constructor() {
    super('LunaDesktopDB');
    this.version(1).stores({
      store: '' // out-of-line keys
    });
  }
}
export const db = new LunaDB();

const setItem = async (key: string, value: any): Promise<void> => {
  await db.store.put(value, key);
};

const getItem = async (key: string): Promise<any> => {
  return await db.store.get(key);
};

const EditableText = ({ defaultText, storageKey, className, style, as: Component = "div" }: { defaultText: string, storageKey: string, className?: string, style?: React.CSSProperties, as?: any }) => {
  const ref = useRef<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    getItem(storageKey).then(val => {
      if (val && ref.current) {
        ref.current.innerText = val;
      }
    });
  }, [storageKey]);

  const handleClick = () => {
    if (!isEditing) {
      setIsEditing(true);
      setTimeout(() => {
        if (ref.current) {
          ref.current.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(ref.current);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 10);
    }
  };

  const handleBlur = (e: any) => {
    setIsEditing(false);
    setItem(storageKey, e.currentTarget.innerText);
  };

  return (
    <Component
      ref={ref}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onClick={handleClick}
      onBlur={handleBlur}
      style={style}
      onPointerDownCapture={(e: any) => {
        if (isEditing) e.stopPropagation();
      }}
      className={`outline-none ${isEditing ? 'cursor-text' : 'cursor-pointer'} ${className}`}
    >
      {defaultText}
    </Component>
  );
};

export default function App() {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState(90);
  const [currentPage, setCurrentPage] = useState(0);
  const [activeApp, setActiveApp] = useState<'desktop' | 'settings' | 'chat_voice'>('desktop');
  const [polaroidOrder, setPolaroidOrder] = useState([0, 1, 2]);
  
  // Chat & Voice State
  const [chatApiUrl, setChatApiUrl] = useState('');
  const [chatApiKey, setChatApiKey] = useState('');
  const [showChatApiKey, setShowChatApiKey] = useState(false);
  const [chatModel, setChatModel] = useState('');
  const [showModelPanel, setShowModelPanel] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [voiceVersion, setVoiceVersion] = useState('官方版');
  const [voiceApiKey, setVoiceApiKey] = useState('');
  const [showVoiceApiKey, setShowVoiceApiKey] = useState(false);
  const [voiceGroupId, setVoiceGroupId] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [models, setModels] = useState<string[]>([]);
  
  const [chatContextCount, setChatContextCount] = useState<number>(20);
  const [chatTemperature, setChatTemperature] = useState<number>(0.7);
  
  interface ChatPreset {
    id: string;
    name: string;
    url: string;
    key: string;
    model: string;
    contextCount: number;
    temperature: number;
  }
  const defaultPreset: ChatPreset = {
    id: 'default',
    name: '默认预设',
    url: '',
    key: '',
    model: '',
    contextCount: 20,
    temperature: 0.7
  };
  const [chatPresets, setChatPresets] = useState<ChatPreset[]>([defaultPreset]);
  const [selectedChatPresetId, setSelectedChatPresetId] = useState<string>('default');
  const [showChatPresetPanel, setShowChatPresetPanel] = useState(false);
  
  const [avatar1, setAvatar1] = useState("Avatar1.png");
  const [avatar2, setAvatar2] = useState("Avatar2.png");
  const [avatar3, setAvatar3] = useState("Avatar3.png");
  const [settingsHeaderImg, setSettingsHeaderImg] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop');
  const [polaroids, setPolaroids] = useState([
    "Polaroid1.png",
    "Polaroid2.png",
    "Polaroid3.png"
  ]);

  useEffect(() => {
    getItem('chatApiUrl').then(v => v && setChatApiUrl(v));
    getItem('chatApiKey').then(v => v && setChatApiKey(v));
    getItem('chatModel').then(v => v && setChatModel(v));
    getItem('chatContextCount').then(v => (v !== null && v !== undefined) && setChatContextCount(v));
    getItem('chatTemperature').then(v => (v !== null && v !== undefined) && setChatTemperature(v));
    getItem('chatPresets').then(v => (v && v.length > 0) && setChatPresets(v));
    getItem('selectedChatPresetId').then(v => v && setSelectedChatPresetId(v));
    
    getItem('voiceVersion').then(v => v && setVoiceVersion(v));
    getItem('voiceApiKey').then(v => v && setVoiceApiKey(v));
    getItem('voiceGroupId').then(v => v && setVoiceGroupId(v));
    getItem('voiceId').then(v => v && setVoiceId(v));

    getItem('avatar1').then(v => v && setAvatar1(v));
    getItem('avatar2').then(v => v && setAvatar2(v));
    getItem('avatar3').then(v => v && setAvatar3(v));
    getItem('settings_header_img').then(v => v && setSettingsHeaderImg(v));
    Promise.all([
      getItem('polaroid_0'),
      getItem('polaroid_1'),
      getItem('polaroid_2')
    ]).then(([p1, p2, p3]) => {
      setPolaroids([
        p1 || "Polaroid1.png",
        p2 || "Polaroid2.png",
        p3 || "Polaroid3.png"
      ]);
    });
  }, []);

  const handleImageUpload = (key: string, setter: (val: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setter(base64);
          setItem(key, base64);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleOriginalImageUpload = (key: string, setter: (val: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setter(base64);
          setItem(key, base64);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handlePolaroidUpload = (index: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const newPolaroids = [...polaroids];
          newPolaroids[index] = base64;
          setPolaroids(newPolaroids);
          setItem(`polaroid_${index}`, base64);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handlePrevPolaroid = () => {
    setPolaroidOrder(prev => [prev[2], prev[0], prev[1]]);
  };

  const handleNextPolaroid = () => {
    setPolaroidOrder(prev => [prev[1], prev[2], prev[0]]);
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  const formatFullTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }).toLowerCase();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleFetchModels = async () => {
    if (!chatApiKey) {
      showToast('请先输入 API Key');
      return;
    }
    
    let baseUrl = chatApiUrl.trim();
    if (!baseUrl) {
      baseUrl = 'https://api.minimax.chat';
    }
    baseUrl = baseUrl.replace(/\/+$/, '');
    const fetchUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

    try {
      const response = await fetch(fetchUrl, {
        headers: {
          'Authorization': `Bearer ${chatApiKey}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          setModels(data.data.map((m: any) => m.id));
        } else {
          setModels(['abab6.5s-chat', 'abab6.5-chat', 'abab6-chat']);
        }
        setShowModelPanel(true);
        showToast('获取模型成功');
      } else {
        showToast(`获取失败: ${response.status}`);
      }
    } catch (error) {
      showToast('网络错误或跨域限制');
    }
  };

  const handleTestChat = async () => {
    if (!chatApiKey || !chatModel) {
      showToast('请完善 API 信息');
      return;
    }
    showToast('测试成功');
  };

  const handleSaveChat = async () => {
    await setItem('chatApiUrl', chatApiUrl);
    await setItem('chatApiKey', chatApiKey);
    await setItem('chatModel', chatModel);
    await setItem('chatContextCount', chatContextCount);
    await setItem('chatTemperature', chatTemperature);
    
    const updatedPresets = chatPresets.map(p => 
      p.id === selectedChatPresetId 
        ? { ...p, url: chatApiUrl, key: chatApiKey, model: chatModel, contextCount: chatContextCount, temperature: chatTemperature }
        : p
    );
    setChatPresets(updatedPresets);
    await setItem('chatPresets', updatedPresets);
    await setItem('selectedChatPresetId', selectedChatPresetId);

    showToast('保存成功');
  };

  const handleAddPreset = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = Date.now().toString();
    const newPreset: ChatPreset = {
      id: newId,
      name: `预设 ${chatPresets.length + 1}`,
      url: chatApiUrl,
      key: chatApiKey,
      model: chatModel,
      contextCount: chatContextCount,
      temperature: chatTemperature
    };
    const newPresets = [...chatPresets, newPreset];
    setChatPresets(newPresets);
    setSelectedChatPresetId(newId);
    setShowChatPresetPanel(false);
    showToast('已添加新预设');
    setItem('chatPresets', newPresets);
    setItem('selectedChatPresetId', newId);
  };

  const handleDeletePreset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (chatPresets.length <= 1) {
      showToast('至少保留一个预设');
      return;
    }
    const newPresets = chatPresets.filter(p => p.id !== selectedChatPresetId);
    setChatPresets(newPresets);
    const nextPreset = newPresets[0];
    setSelectedChatPresetId(nextPreset.id);
    
    setChatApiUrl(nextPreset.url);
    setChatApiKey(nextPreset.key);
    setChatModel(nextPreset.model);
    setChatContextCount(nextPreset.contextCount);
    setChatTemperature(nextPreset.temperature);
    
    setShowChatPresetPanel(false);
    showToast('预设已删除');
    
    setItem('chatPresets', newPresets);
    setItem('selectedChatPresetId', nextPreset.id);
    setItem('chatApiUrl', nextPreset.url);
    setItem('chatApiKey', nextPreset.key);
    setItem('chatModel', nextPreset.model);
    setItem('chatContextCount', nextPreset.contextCount);
    setItem('chatTemperature', nextPreset.temperature);
  };

  const handleSelectPreset = (preset: ChatPreset) => {
    setSelectedChatPresetId(preset.id);
    setChatApiUrl(preset.url);
    setChatApiKey(preset.key);
    setChatModel(preset.model);
    setChatContextCount(preset.contextCount);
    setChatTemperature(preset.temperature);
    setShowChatPresetPanel(false);
    
    setItem('selectedChatPresetId', preset.id);
    setItem('chatApiUrl', preset.url);
    setItem('chatApiKey', preset.key);
    setItem('chatModel', preset.model);
    setItem('chatContextCount', preset.contextCount);
    setItem('chatTemperature', preset.temperature);
  };

  const handleSaveVoice = () => {
    setItem('voiceVersion', voiceVersion);
    setItem('voiceApiKey', voiceApiKey);
    setItem('voiceGroupId', voiceGroupId);
    setItem('voiceId', voiceId);
    showToast('保存成功');
  };

  const handleDragEnd = (e: any, info: any) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    if (offset < -20 || velocity < -200) {
      setCurrentPage(1);
    } else if (offset > 20 || velocity > 200) {
      setCurrentPage(0);
    }
  };

  return (
    <div 
      className="w-full h-[100dvh] overflow-hidden bg-cover bg-center relative"
      style={{ 
        backgroundImage: 'url(Wallpaper.png)',
        backgroundColor: '#e0e5ec'
      }}
    >
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear,
        input[type="password"]::-webkit-reveal,
        input[type="password"]::-webkit-clear-button {
          display: none !important;
        }
        /* Sleek Slider */
        input[type=range].sleek-slider {
          -webkit-appearance: none;
          width: 100%;
          background: transparent;
        }
        input[type=range].sleek-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 4px;
          border-radius: 2px;
          background: #ffffff;
          cursor: pointer;
          margin-top: -4px;
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        input[type=range].sleek-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }
        input[type=range].sleek-slider:focus {
          outline: none;
        }
      `}</style>
      {/* Overlay for better contrast and ins-style muted tone */}
      <div className="absolute inset-0 bg-white/10 mix-blend-overlay pointer-events-none"></div>
      
      {/* Main Content Container - Constrained width for desktop, full width for mobile */}
      <div ref={constraintsRef} className="max-w-[430px] mx-auto h-full relative flex flex-col no-scrollbar overflow-hidden">
        
        {/* Status Bar (Fixed) */}
        <div className="flex justify-between items-center px-6 pt-4 pb-2 text-white/90 text-sm relative z-[150] drop-shadow-md pointer-events-none">
          <span className="font-bold ml-[5px] tracking-wider">{formatTime(time)}</span>
          <div className="flex items-center gap-1.5">
            <IosCellular className="text-white/90" />
            <span className="text-xs font-bold">4G</span>
            <IosBattery level={batteryLevel} />
          </div>
        </div>

        {/* Swipeable Pages Container */}
        <motion.div
          className="flex w-[200%] flex-1 touch-pan-y"
          animate={{ x: currentPage === 0 ? "0%" : "-50%" }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          drag="x"
          dragConstraints={{
            left: currentPage === 0 ? -1000 : 0,
            right: currentPage === 1 ? 1000 : 0
          }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
        >
          {/* Page 0 */}
          <div className="w-1/2 h-full flex flex-col no-scrollbar overflow-y-auto pb-48">
            {/* Top Large Widget */}
            <div className="mx-[20px] mt-2 rounded-[36px] bg-white/10 backdrop-blur-[24px] border border-white/20 p-5 text-white shadow-sm flex flex-col justify-between relative aspect-square">
              {/* Inner subtle gradient for non-white glass effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 pointer-events-none rounded-[36px]"></div>
              
              {/* Profile */}
              <div className="flex justify-between items-start relative z-10">
                <div className="flex gap-3 items-center">
                  <img src={avatar1} onClick={() => handleImageUpload('avatar1', setAvatar1)} alt="Profile" className="w-14 h-14 rounded-full object-cover border-[0.5px] border-white shadow-sm cursor-pointer" />
                  <div>
                    <EditableText defaultText="Goniai_" storageKey="text_name" as="h2" className="text-lg font-semibold tracking-wide drop-shadow-sm" />
                    <EditableText defaultText="如果萌是一种天赋 ovo" storageKey="text_bio" as="p" className="text-xs text-white/80 drop-shadow-sm" />
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md shadow-sm">
                  <Home size={16} className="text-white/90" />
                </div>
              </div>

              {/* Icons & Search */}
              <div className="flex justify-between items-center mt-1 relative z-10">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shadow-sm"><IosWifiIcon className="text-white/90" /></div>
                  <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shadow-sm"><AntennaIcon className="text-white/90" /></div>
                  <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shadow-sm"><BluetoothIcon className="text-white/90" /></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/70 tracking-widest drop-shadow-sm">+*&lt;3 ☆ &lt;3 *+</span>
                  <div className="bg-white/20 border border-white/30 px-3 py-1.5 rounded-full flex items-center gap-1 text-[11px] backdrop-blur-md shadow-sm text-white/90">
                    <Sparkles size={12} /> Search
                  </div>
                </div>
              </div>

              {/* Images */}
              <div className="flex justify-between gap-2 mt-2 relative z-10">
                 <div 
                   onClick={handlePrevPolaroid} 
                   className="absolute top-1/2 -left-3 w-6 h-6 bg-white/20 border border-white/30 rounded-full flex items-center justify-center -translate-y-1/2 z-30 backdrop-blur-md shadow-sm cursor-pointer"
                 >
                   <ChevronLeft size={14} className="text-white/90" />
                 </div>
                 <img src={polaroids[polaroidOrder[0]]} onClick={() => handlePolaroidUpload(polaroidOrder[0])} className="w-[31%] aspect-square rounded-[20px] object-cover shadow-sm border border-white/20 transition-all duration-300 cursor-pointer" />
                 <img src={polaroids[polaroidOrder[1]]} onClick={() => handlePolaroidUpload(polaroidOrder[1])} className="w-[31%] aspect-square rounded-[20px] object-cover shadow-sm border border-white/20 transition-all duration-300 cursor-pointer" />
                 <img src={polaroids[polaroidOrder[2]]} onClick={() => handlePolaroidUpload(polaroidOrder[2])} className="w-[31%] aspect-square rounded-[20px] object-cover shadow-sm border border-white/20 transition-all duration-300 cursor-pointer" />
                 <div 
                   onClick={handleNextPolaroid} 
                   className="absolute top-1/2 -right-3 w-6 h-6 bg-white/20 border border-white/30 rounded-full flex items-center justify-center -translate-y-1/2 z-30 backdrop-blur-md shadow-sm cursor-pointer"
                 >
                   <ChevronRight size={14} className="text-white/90" />
                 </div>
              </div>

              {/* Time & Icons */}
              <div className="flex justify-between items-center px-2 mt-2 relative z-10">
                <Heart size={20} strokeWidth={2} className="text-white/90 drop-shadow-sm" />
                <Send size={20} strokeWidth={2} className="text-white/90 drop-shadow-sm" />
                <div className="text-xl font-light tracking-widest drop-shadow-md">{formatFullTime(time)}</div>
                <Sparkles size={20} className="text-white/90 drop-shadow-sm" />
              </div>

              {/* Info Rows */}
              <div className="flex flex-col gap-3 px-1 relative z-10">
                <div className="flex items-center gap-3 text-xs text-white/90 drop-shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shadow-sm"><Star size={12} className="text-white/90" /></div>
                  <EditableText defaultText="幸运星座 射手座" storageKey="text_star" as="span" className="tracking-wide" />
                  <EditableText defaultText="幸运颜色 珍珠白" storageKey="text_color" as="span" className="ml-2 tracking-wide" />
                </div>
                <div className="flex items-center gap-3 text-xs text-white/90 drop-shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shadow-sm"><Cloud size={12} className="text-white/90" /></div>
                  <EditableText defaultText="今天的天气 雾" storageKey="text_weather" as="span" className="tracking-wide" />
                </div>
              </div>
            </div>

            {/* Top Widgets Text */}
            <div className="text-center mt-4 mb-2">
              <span className="text-white/70 text-xs tracking-widest drop-shadow-sm">Top Widgets⁺</span>
            </div>

            {/* Middle Section */}
            <div className="px-[20px] flex gap-4">
              {/* Left Icons Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 w-1/2 place-items-center">
                <AppIcon icon={<User size={28} strokeWidth={1.5} />} name="联系人" />
                <AppIcon icon={<Instagram size={28} strokeWidth={1.5} />} name="INS" />
                <AppIcon icon={<Compass size={28} strokeWidth={1.5} />} name="- Findus" />
                <AppIcon icon={<ShoppingBag size={28} strokeWidth={1.5} />} name="淘宝" />
              </div>

              {/* Right Widgets */}
              <div className="w-1/2 flex flex-col gap-4">
                {/* Text Widget */}
                <div className="bg-white/10 backdrop-blur-[24px] border border-white/20 rounded-[28px] p-4 flex flex-col justify-center items-center text-center gap-2.5 h-[120px] shadow-sm relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                  <EditableText defaultText="Could have been anyone" storageKey="text_lyric1" as="p" className="text-[11px] text-white/70 drop-shadow-sm tracking-wide relative z-10" />
                  <EditableText defaultText="Say you love me" storageKey="text_lyric2" as="p" className="text-[11px] text-white/90 drop-shadow-sm tracking-wide relative z-10" />
                  <EditableText defaultText="Could have been anyone" storageKey="text_lyric3" as="p" className="text-[11px] text-white/70 drop-shadow-sm tracking-wide relative z-10" />
                  <EditableText defaultText="Say you need me" storageKey="text_lyric4" as="p" className="text-[11px] text-white/90 drop-shadow-sm tracking-wide relative z-10" />
                </div>

                {/* Music Widget */}
                <div className="bg-white/10 backdrop-blur-[24px] border border-white/20 rounded-[28px] p-2.5 flex items-center justify-between h-[65px] shadow-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                  <img src={avatar2} onClick={() => handleImageUpload('avatar2', setAvatar2)} className="w-11 h-11 rounded-full object-cover border border-white/30 shadow-sm cursor-pointer relative z-10" />
                  <div className="flex-1 px-1 flex items-center justify-center relative z-10">
                     <WaveformIcon />
                  </div>
                  <img src={avatar3} onClick={() => handleImageUpload('avatar3', setAvatar3)} className="w-11 h-11 rounded-full object-cover border border-white/30 shadow-sm cursor-pointer relative z-10" />
                </div>
                
                <div className="text-center mt-[-4px]">
                  <span className="text-white/70 text-xs tracking-widest drop-shadow-sm">Top Widgets⁺</span>
                </div>
              </div>
            </div>
          </div>

          {/* Page 1 */}
          <div className="w-1/2 h-full flex flex-col no-scrollbar overflow-y-auto pb-48 relative">
            <div className="absolute inset-0 bg-transparent"></div>
          </div>
        </motion.div>

        {/* Fixed Bottom Elements (Pagination, Search, Dock) */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none flex flex-col items-center z-50">
          
          {/* Search Capsule */}
          <div className="mb-3 pointer-events-auto">
            <div className="px-5 py-1.5 rounded-full border border-white/30 bg-white/5 backdrop-blur-md flex items-center gap-1.5 text-white/80 text-xs shadow-sm">
              <Search size={12} />
              <span className="tracking-widest">搜索</span>
            </div>
          </div>

          {/* Pagination Dots */}
          <div className="flex gap-2 mb-3 pointer-events-auto">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${currentPage === 0 ? 'bg-white' : 'bg-white/40'}`} />
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${currentPage === 1 ? 'bg-white' : 'bg-white/40'}`} />
          </div>

          {/* Bottom Dock */}
          <div className="w-[calc(100%-40px)] max-w-[390px] h-[85px] bg-white/10 backdrop-blur-[32px] border border-white/20 rounded-[36px] flex items-center justify-around px-2 shadow-md overflow-hidden mb-5 pointer-events-auto relative">
            <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent pointer-events-none"></div>
            <DockIcon icon={<MessageCircle size={32} strokeWidth={1.2} />} />
            <DockIcon icon={<Globe size={32} strokeWidth={1.2} />} />
            <DockIcon icon={<Palette size={32} strokeWidth={1.2} />} />
            <div onClick={() => setActiveApp('settings')}>
              <DockIcon icon={<Settings size={32} strokeWidth={1.2} />} />
            </div>
          </div>

        </div>

        {/* Settings App Overlay */}
        <AnimatePresence>
          {activeApp === 'settings' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-0 z-[100] bg-black/20 backdrop-blur-xl overflow-y-auto no-scrollbar flex flex-col pt-[50px]"
            >
            {/* Header Image & Title */}
            <div className="relative w-full mt-[20px]">
              <div className="w-[85%] aspect-[820/461]">
                <img 
                  src={settingsHeaderImg} 
                  onClick={() => handleOriginalImageUpload('settings_header_img', setSettingsHeaderImg)}
                  className="w-full h-full object-cover cursor-pointer"
                  alt="Settings Header"
                />
              </div>
              
              {/* Text Elements - 1/4 height, right aligned */}
              <div className="absolute top-[25%] right-0 flex flex-col items-end text-right z-10">
                <h1 
                  onClick={() => setActiveApp('desktop')}
                  className="text-white text-[32px] tracking-wider drop-shadow-lg cursor-pointer hover:opacity-80 transition-opacity" 
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  PREFERENCES
                </h1>
                <EditableText 
                  defaultText="昵称" 
                  storageKey="settings_nickname" 
                  as="div" 
                  className="text-white/90 text-[16px] mt-3 drop-shadow-md" 
                  style={{ fontFamily: "'Playfair Display', serif" }}
                />
                <EditableText 
                  defaultText="@ 账号" 
                  storageKey="settings_handle" 
                  as="div" 
                  className="text-white/60 text-[16px] mt-1 drop-shadow-md" 
                  style={{ fontFamily: "'Playfair Display', serif" }}
                />
              </div>
            </div>

            {/* Function Area */}
            <div className="flex-1 mt-10 pl-[25px] flex flex-col gap-10 pb-12">
              {[
                '密码与识别', 
                '提示与推送', 
                '聊天与语音', 
                '调试与控制', 
                '数据与储存'
              ].map((title, i) => (
                <div 
                  key={i} 
                  onClick={() => { if (title === '聊天与语音') setActiveApp('chat_voice'); }}
                  className="flex items-center gap-8 group cursor-pointer relative"
                >
                  <span className="text-white/30 text-xs font-mono tracking-widest w-5">
                    0{i + 1}
                  </span>
                  <span className="text-white/80 text-[15px] tracking-widest font-light group-hover:text-white transition-colors">
                    {title}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Chat & Voice Overlay */}
        <AnimatePresence>
        {activeApp === 'chat_voice' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute inset-0 z-[110] bg-black/20 backdrop-blur-xl overflow-y-auto no-scrollbar flex flex-col"
          >
            {/* Toast Notification */}
            <AnimatePresence>
              {toastMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-12 left-1/2 -translate-x-1/2 z-[120] bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full text-sm shadow-lg"
                >
                  {toastMessage}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-[60px] px-6 pb-6">
              <div className="flex items-center gap-4 mb-8">
                <ChevronLeft 
                  size={28} 
                  className="text-white cursor-pointer" 
                  onClick={() => setActiveApp('settings')} 
                />
                <h1 className="text-white text-2xl font-light tracking-wider">聊天与语音</h1>
              </div>

              {/* API Chat Section */}
              <div className="mb-10">
                <h2 className="text-white/80 text-sm tracking-widest mb-6 font-medium">API 聊天</h2>
                <div className="flex flex-col gap-5">
                  
                  {/* Presets */}
                  <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs tracking-wider ml-1">预设内容</span>
                    <div className="relative">
                      <div 
                        className="flex justify-between items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/10 cursor-pointer"
                        onClick={() => setShowChatPresetPanel(!showChatPresetPanel)}
                      >
                        <span className="text-white/90 text-sm">
                          {chatPresets.find(p => p.id === selectedChatPresetId)?.name || '默认预设'}
                        </span>
                        <div className="flex gap-3 items-center">
                          <Plus size={18} className="text-white/70 cursor-pointer hover:text-white" onClick={handleAddPreset} />
                          <Trash2 size={18} className="text-white/70 cursor-pointer hover:text-red-400" onClick={handleDeletePreset} />
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {showChatPresetPanel && chatPresets.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-black/40 backdrop-blur-xl border border-white/20 rounded-2xl max-h-[150px] overflow-y-auto no-scrollbar z-20 shadow-xl"
                          >
                            {chatPresets.map(p => (
                              <div 
                                key={p.id} 
                                className={`px-4 py-3 text-sm cursor-pointer border-b border-white/5 last:border-0 ${p.id === selectedChatPresetId ? 'text-white bg-white/10' : 'text-white/80 hover:bg-white/5'}`}
                                onClick={() => handleSelectPreset(p)}
                              >
                                {p.name}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* API URL */}
                  <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs tracking-wider ml-1">API 接口网址</span>
                    <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                      <input 
                        type="text" 
                        placeholder="https://..." 
                        value={chatApiUrl}
                        onChange={(e) => setChatApiUrl(e.target.value)}
                        className="w-full bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs tracking-wider ml-1">API Key</span>
                    <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10 flex items-center gap-3">
                      <input 
                        type={showChatApiKey ? "text" : "password"} 
                        placeholder="sk-..." 
                        value={chatApiKey}
                        onChange={(e) => setChatApiKey(e.target.value)}
                        className="flex-1 bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30"
                      />
                      <div className="flex items-center gap-3 pl-2">
                        {showChatApiKey ? 
                          <EyeOff size={16} className="text-white cursor-pointer" onClick={() => setShowChatApiKey(false)} /> : 
                          <Eye size={16} className="text-white cursor-pointer" onClick={() => setShowChatApiKey(true)} />
                        }
                        <Download size={16} className="text-white cursor-pointer" onClick={handleFetchModels} />
                      </div>
                    </div>
                  </div>

                  {/* API Model */}
                  <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs tracking-wider ml-1">API 模型</span>
                    <div className="relative">
                      <div 
                        className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10 flex justify-between items-center cursor-pointer"
                        onClick={() => setShowModelPanel(!showModelPanel)}
                      >
                        <span className={chatModel ? "text-white/90 text-sm" : "text-white/30 text-sm"}>
                          {chatModel || "选择模型"}
                        </span>
                        <ChevronDown size={16} className="text-white/60" />
                      </div>
                      
                      <AnimatePresence>
                        {showModelPanel && models.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-black/40 backdrop-blur-xl border border-white/20 rounded-2xl max-h-[150px] overflow-y-auto no-scrollbar z-20 shadow-xl"
                          >
                            {models.map(m => (
                              <div 
                                key={m} 
                                className="px-4 py-3 text-sm text-white/80 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0"
                                onClick={() => { setChatModel(m); setShowModelPanel(false); }}
                              >
                                {m}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Context Count */}
                  <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs tracking-wider ml-1">携带上下文数量</span>
                    <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                      <input 
                        type="number" 
                        placeholder="默认 20" 
                        value={chatContextCount}
                        onChange={(e) => setChatContextCount(Number(e.target.value))}
                        className="w-full bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* Temperature */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center ml-1">
                      <span className="text-white/60 text-xs tracking-wider">模型温度</span>
                      <span className="text-white/60 text-xs">{chatTemperature.toFixed(1)}</span>
                    </div>
                    <div className="bg-white/5 rounded-2xl px-4 py-4 border border-white/10 flex items-center">
                      <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.1"
                        value={chatTemperature}
                        onChange={(e) => setChatTemperature(Number(e.target.value))}
                        className="sleek-slider"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 mt-4">
                    <button onClick={handleTestChat} className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-sm font-medium transition-colors">
                      测试
                    </button>
                    <button onClick={handleSaveChat} className="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors">
                      保存
                    </button>
                  </div>

                </div>
              </div>

              {/* API Voice Section */}
              <div className="mb-10">
                <h2 className="text-white/80 text-sm tracking-widest mb-6 font-medium">API 语音</h2>
                <div className="flex flex-col gap-5">
                  
                  {/* Presets */}
                  <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs tracking-wider ml-1">预设内容</span>
                    <div className="flex justify-between items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                      <span className="text-white/90 text-sm">默认预设</span>
                      <div className="flex gap-3">
                        <Plus size={18} className="text-white/70 cursor-pointer hover:text-white" />
                        <Trash2 size={18} className="text-white/70 cursor-pointer hover:text-red-400" />
                      </div>
                    </div>
                  </div>

                  {/* Version Toggle */}
                  <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs tracking-wider ml-1">版本选择</span>
                    <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
                      <div 
                        className={`flex-1 text-center py-2 rounded-xl text-sm cursor-pointer transition-colors ${voiceVersion === '官方版' ? 'bg-white/20 text-white' : 'text-white/50'}`}
                        onClick={() => setVoiceVersion('官方版')}
                      >
                        官方版
                      </div>
                      <div 
                        className={`flex-1 text-center py-2 rounded-xl text-sm cursor-pointer transition-colors ${voiceVersion === '海外版' ? 'bg-white/20 text-white' : 'text-white/50'}`}
                        onClick={() => setVoiceVersion('海外版')}
                      >
                        海外版
                      </div>
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs tracking-wider ml-1">API Key</span>
                    <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10 flex items-center gap-3">
                      <input 
                        type={showVoiceApiKey ? "text" : "password"} 
                        placeholder="sk-..." 
                        value={voiceApiKey}
                        onChange={(e) => setVoiceApiKey(e.target.value)}
                        className="flex-1 bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30"
                      />
                      <div className="flex items-center gap-3 pl-2">
                        {showVoiceApiKey ? 
                          <EyeOff size={16} className="text-white cursor-pointer" onClick={() => setShowVoiceApiKey(false)} /> : 
                          <Eye size={16} className="text-white cursor-pointer" onClick={() => setShowVoiceApiKey(true)} />
                        }
                      </div>
                    </div>
                  </div>

                  {/* Group ID */}
                  <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs tracking-wider ml-1">Group ID</span>
                    <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                      <input 
                        type="text" 
                        placeholder="输入 Group ID" 
                        value={voiceGroupId}
                        onChange={(e) => setVoiceGroupId(e.target.value)}
                        className="w-full bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* Voice ID */}
                  <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs tracking-wider ml-1">Voice ID</span>
                    <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                      <input 
                        type="text" 
                        placeholder="输入 Voice ID" 
                        value={voiceId}
                        onChange={(e) => setVoiceId(e.target.value)}
                        className="w-full bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => showToast('测试成功')} className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-sm font-medium transition-colors">
                      测试
                    </button>
                    <button onClick={handleSaveVoice} className="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors">
                      保存
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

      </div>
    </div>
  );
}

function AppIcon({ icon, name }: { icon: React.ReactNode, name: string }) {
  return (
    <div className="flex flex-col items-center gap-2 w-[65px]">
      <div className="w-[65px] h-[65px] rounded-[22px] bg-white/10 backdrop-blur-[20px] border border-white/20 flex items-center justify-center text-white shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
        {icon}
      </div>
      <span className="text-white/90 text-[11px] font-medium tracking-wider drop-shadow-md whitespace-nowrap">{name}</span>
    </div>
  );
}

function DockIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="w-[65px] h-[65px] rounded-[22px] bg-white/10 backdrop-blur-[20px] border border-white/20 flex items-center justify-center text-white shadow-sm hover:bg-white/20 transition-colors cursor-pointer relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
      {icon}
    </div>
  );
}

function BluetoothIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className || "text-pink-100"}>
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"></polyline>
    </svg>
  );
}

function WaveformIcon() {
  return (
    <svg width="40" height="20" viewBox="0 0 40 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/80 drop-shadow-sm">
      <path d="M0 10 L5 10 L8 4 L12 16 L16 8 L20 12 L24 2 L28 18 L32 10 L40 10" />
    </svg>
  )
}

function IosCellular({ className }: { className?: string }) {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" className={className}>
      <rect x="0" y="8" width="2.5" height="4" rx="1" />
      <rect x="4.5" y="5.5" width="2.5" height="6.5" rx="1" />
      <rect x="9" y="3" width="2.5" height="9" rx="1" />
      <rect x="13.5" y="0" width="2.5" height="12" rx="1" />
    </svg>
  );
}

function IosCellularWidget({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-[2px] ${className || ''}`}>
      <svg width="12" height="10" viewBox="0 0 16 12" fill="currentColor">
        <rect x="0" y="8" width="2.5" height="4" rx="1" />
        <rect x="4.5" y="5.5" width="2.5" height="6.5" rx="1" />
        <rect x="9" y="3" width="2.5" height="9" rx="1" />
        <rect x="13.5" y="0" width="2.5" height="12" rx="1" />
      </svg>
      <span className="text-[7px] font-bold leading-none tracking-tighter">5G</span>
    </div>
  );
}

function AntennaIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 10v10" />
      <circle cx="12" cy="6" r="2" fill="currentColor" stroke="none" />
      <path d="M8 6.5a5 5 0 0 0 0 7" />
      <path d="M16 6.5a5 5 0 0 1 0 7" />
      <path d="M5 3.5a9 9 0 0 0 0 13" />
      <path d="M19 3.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function IosWifiIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 10a12 12 0 0 1 16 0" />
      <path d="M8 14.5a6 6 0 0 1 8 0" />
      <circle cx="12" cy="19.5" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IosBattery({ level }: { level: number }) {
  return (
    <div className="flex items-center">
      <div className="w-[22px] h-[11px] border border-white/80 rounded-[3px] p-[1px] relative flex">
        <div className="h-full bg-white rounded-[1.5px]" style={{ width: `${level}%` }}></div>
      </div>
      <div className="w-[1.5px] h-[4px] bg-white/80 rounded-r-sm ml-[1px]"></div>
    </div>
  );
}
