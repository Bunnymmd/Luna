(() => {
  const app = document.getElementById("instagram-app");
  if (!app) {
    return;
  }

  const dbName = "LunaDesktopDB";
  const storeName = "store";
  const statOrder = ["posts", "followers", "following"];
  const statLabels = {
    posts: "帖子",
    followers: "粉丝",
    following: "关注"
  };

  const typeMeta = {
    CHAR: {
      label: "角色",
      location: "主线角色",
      signature: "更适合放在首页的真实角色信息。",
      content: "把角色设定、签名和联系人资料直接映射到首页卡片。",
      online: "刚刚在线"
    },
    NPC: {
      label: "NPC",
      location: "场景角色",
      signature: "更像环境里真实存在的人物位。",
      content: "用联系人卡片替换原来写死的虚构账号，信息更真实。",
      online: "5 分钟前在线"
    },
    USER: {
      label: "USER",
      location: "用户身份",
      signature: "这个身份可以直接进入聊天和搜索结果。",
      content: "资料和头像统一持久化，刷新后不会丢失。",
      online: "在线"
    },
    RELATIONSHIP: {
      label: "关系",
      location: "关系角色",
      signature: "更适合展示关系链和高光内容。",
      content: "顶部 stories 现在优先读取联系人，而不是虚构账号。",
      online: "1 小时前在线"
    },
    DEFAULT: {
      label: "联系人",
      location: "联系人",
      signature: "联系人信息会优先出现在 Instagram 页面里。",
      content: "联系人数据会替换原本的虚构用户。",
      online: "最近在线"
    }
  };

  const instagramPalettePresets = [
    ["#f58529", "#feda77"],
    ["#fd1d1d", "#f77737"],
    ["#dd2a7b", "#fcb045"],
    ["#c13584", "#833ab4"],
    ["#5851db", "#405de6"],
    ["#fcaf45", "#e1306c"]
  ];

  const defaultProfile = {
    avatar: "",
    username: "luna.verse",
    name: "Luna",
    bio: "内容整理 / 视觉设定 / 交互细化",
    link: "luna.example/kit",
    location: "Shanghai, CN",
    linkedUserId: "",
    stats: {
      posts: 248,
      followers: 41900,
      following: 623
    }
  };
  const legacyProfileBioNote = "这版 Instagram 资料页支持头像和资料持久化。";

  const profileTabs = [
    { id: "posts", label: "帖子", icon: "grid" },
    { id: "reels", label: "Reels", icon: "reels" },
    { id: "tagged", label: "标记", icon: "tag" },
    { id: "saved", label: "收藏", icon: "bookmark" }
  ];

  const state = {
    tab: "home",
    reelIndex: 0,
    dmChatId: null,
    profileTab: "posts",
    searchQuery: "",
    profileEditorOpen: false,
    profileDraft: null,
    profileSettingsOpen: false,
    settingsDraft: null,
    presetDraftName: "",
    statEditor: null,
    statDraft: "",
    history: []
  };

  let contacts = [];
  let profile = normalizeProfile(defaultProfile);
  let profilePresets = [];
  let desktopAvatar = "";
  let pointerStart = null;
  let dragRail = null;
  let lastWheelAt = 0;

  function fallbackGet(key) {
    try {
      const value = localStorage.getItem(`luna_${key}`);
      if (!value) {
        return void 0;
      }
      return JSON.parse(value);
    } catch (error) {
      return void 0;
    }
  }

  function fallbackSet(key, value) {
    try {
      localStorage.setItem(`luna_${key}`, JSON.stringify(value));
    } catch (error) {
      return;
    }
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("indexedDB unavailable"));
        return;
      }

      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getItem(key) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      return fallbackGet(key);
    }
  }

  async function setItem(key, value) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        tx.objectStore(storeName).put(value, key);
      });
    } catch (error) {
      fallbackSet(key, value);
    }
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return char;
      }
    });
  }

  function escapeHtmlWithBreaks(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function paletteStyle(palette) {
    return `style="--ig-a:${palette[0]};--ig-b:${palette[1]};"`;
  }

  function initials(value) {
    return String(value)
      .split(/[._\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] ? part[0].toUpperCase() : "")
      .join("") || "IG";
  }

  function trimZero(value) {
    return String(value).replace(/\.0$/, "");
  }

  function parseCountInput(input) {
    if (typeof input === "number" && Number.isFinite(input)) {
      return Math.max(0, Math.round(input));
    }

    if (typeof input !== "string") {
      return null;
    }

    const normalized = input
      .trim()
      .replace(/,/g, "")
      .replace(/\s+/g, "")
      .replace(/位|人|个|粉|次|帖|篇|关注|粉丝|帖子|\+/g, "")
      .toLowerCase();

    if (!normalized) {
      return null;
    }

    const match = normalized.match(/^(-?\d+(?:\.\d+)?)([a-z\u4e00-\u9fa5]*)$/i);
    if (!match) {
      return null;
    }

    const value = Number(match[1]);
    if (!Number.isFinite(value)) {
      return null;
    }

    const unit = match[2];
    const unitMap = {
      "": 1,
      k: 1e3,
      千: 1e3,
      w: 1e4,
      万: 1e4,
      m: 1e6,
      百万: 1e6,
      b: 1e9,
      亿: 1e8
    };

    const multiplier = unitMap[unit];
    if (!multiplier) {
      return null;
    }

    return Math.max(0, Math.round(value * multiplier));
  }

  function formatCountDisplay(value) {
    const count = Math.max(0, Number(value) || 0);
    if (count >= 1e8) {
      const scaled = count / 1e8;
      return `${trimZero((scaled < 100 ? scaled.toFixed(1) : scaled.toFixed(0)))}亿`;
    }
    if (count >= 1e4) {
      const scaled = count / 1e4;
      return `${trimZero((scaled < 100 ? scaled.toFixed(1) : scaled.toFixed(0)))}万`;
    }
    return count.toLocaleString("zh-CN");
  }

  function formatStatPreview(value) {
    const parsed = parseCountInput(value);
    if (parsed === null) {
      return {
        display: "请输入数字或带单位的数量",
        detail: "支持 12000、1.2w、1.2万、3k、2m、3亿 这类输入。"
      };
    }

    return {
      display: formatCountDisplay(parsed),
      detail: `实际数量：${parsed.toLocaleString("zh-CN")}`
    };
  }

  function getCountClassName(display) {
    if (display.length >= 8) {
      return "instagram-profile-stat__value instagram-profile-stat__value--tight";
    }
    if (display.length >= 6) {
      return "instagram-profile-stat__value instagram-profile-stat__value--compact";
    }
    return "instagram-profile-stat__value";
  }

  function pickText(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  }

  function getTypeInfo(type) {
    return typeMeta[type] || typeMeta.DEFAULT;
  }

  function hashString(value) {
    return Array.from(String(value)).reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
  }

  function seededCount(seed, base = 0, range = 12000) {
    return base + (Math.abs(hashString(seed)) % range);
  }

  function getInstagramPalette(seed, offset = 0) {
    const index = Math.abs(hashString(`${seed}:${offset}`)) % instagramPalettePresets.length;
    return instagramPalettePresets[index];
  }

  function normalizeInlineText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function sanitizeProfileBio(value) {
    return String(value || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line !== legacyProfileBioNote)
      .join("\n")
      .trim();
  }

  function getTextParts(value) {
    return String(value || "")
      .replace(/\r/g, "")
      .split(/\n|[。！？!?]/)
      .map((part) => normalizeInlineText(part))
      .filter(Boolean);
  }

  function clipText(value, max = 24) {
    const normalized = normalizeInlineText(value);
    if (!normalized) {
      return "";
    }
    if (normalized.length <= max) {
      return normalized;
    }
    return `${normalized.slice(0, Math.max(1, max - 1))}…`;
  }

  function getHeadline(primary, fallback, max = 16) {
    return clipText(getTextParts(primary)[0] || fallback, max);
  }

  function getSubline(primary, secondary, fallback, max = 26) {
    const nextPart = getTextParts(primary)[1];
    return clipText(nextPart || secondary || fallback, max);
  }

  function getContactDisplayName(contact, fallback = "联系人") {
    return pickText(contact?.nickname, contact?.name, fallback);
  }

  function getContactPreview(contact, fallback = "资料已同步") {
    return clipText(pickText(contact?.signature, contact?.content, contact?.name, fallback), 34);
  }

  function getUserContacts() {
    return contacts
      .filter((item) => item.type === "USER")
      .map((item, index) => normalizeContact(item, index));
  }

  function getLinkedUser() {
    const users = getUserContacts();
    if (!users.length) {
      return null;
    }
    return users.find((item) => item.id === profile.linkedUserId) || users[0];
  }

  function getProfileAvatar(linkedUser = getLinkedUser()) {
    return desktopAvatar || profile.avatar || linkedUser?.avatar || "";
  }

  function getProfileIdentityName(linkedUser = getLinkedUser()) {
    return getContactDisplayName(linkedUser, pickText(profile.name, profile.username, "USER"));
  }

  function getProfileIdentityStatus(linkedUser = getLinkedUser()) {
    return linkedUser ? `${getProfileIdentityName(linkedUser)} 在线` : "未关联 USER 身份";
  }

  function getResolvedProfile(linkedUser = getLinkedUser()) {
    return {
      ...profile,
      avatar: getProfileAvatar(linkedUser),
      identityName: getProfileIdentityName(linkedUser),
      identityStatus: getProfileIdentityStatus(linkedUser)
    };
  }

  function normalizeContact(contact, index = 0) {
    const info = getTypeInfo(contact?.type);
    return {
      id: pickText(contact?.id, `contact-${index + 1}`),
      type: pickText(contact?.type, "DEFAULT"),
      avatar: typeof contact?.avatar === "string" ? contact.avatar : "",
      nickname: pickText(contact?.nickname),
      name: pickText(contact?.name),
      signature: pickText(contact?.signature, info.signature),
      content: pickText(contact?.content, info.content)
    };
  }

  function normalizeProfile(input) {
    const source = input && typeof input === "object" ? input : defaultProfile;
    const stats = {};

    statOrder.forEach((key) => {
      const fallbackValue = defaultProfile.stats[key];
      const parsed = parseCountInput(source.stats?.[key] ?? fallbackValue);
      stats[key] = parsed === null ? fallbackValue : parsed;
    });

    return {
      avatar: typeof source.avatar === "string" ? source.avatar : "",
      username: pickText(source.username, defaultProfile.username),
      name: pickText(source.name, defaultProfile.name),
      bio: pickText(sanitizeProfileBio(source.bio), defaultProfile.bio),
      link: pickText(source.link, defaultProfile.link),
      location: pickText(source.location, defaultProfile.location),
      linkedUserId: pickText(source.linkedUserId),
      stats
    };
  }

  function toHandle(value, fallback) {
    const normalized = String(value)
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(".");
    return normalized || fallback;
  }

  function buildActors() {
    const linkedUser = getLinkedUser();
    const resolvedProfile = getResolvedProfile(linkedUser);
    const source = contacts.map((item, index) => normalizeContact(item, index));
    const ordered = [];

    if (linkedUser) {
      ordered.push({
        ...linkedUser,
        avatar: resolvedProfile.avatar
      });
    }

    source.forEach((item) => {
      if (!ordered.some((existing) => existing.id === item.id)) {
        ordered.push(item);
      }
    });

    if (!ordered.length) {
      ordered.push({
        id: "profile-owner",
        type: "USER",
        avatar: resolvedProfile.avatar,
        nickname: resolvedProfile.identityName,
        name: resolvedProfile.name,
        signature: resolvedProfile.bio,
        content: resolvedProfile.bio
      });
    }

    return ordered.slice(0, 12).map((item, index) => {
      const info = getTypeInfo(item.type);
      const name = getContactDisplayName(item, `联系人${index + 1}`);
      const isLinkedUser = Boolean(
        (linkedUser && item.id === linkedUser.id) ||
        (!linkedUser && item.id === "profile-owner")
      );
      return {
        id: item.id,
        type: item.type,
        name,
        handle: isLinkedUser
          ? pickText(resolvedProfile.username, toHandle(name, `user.${index + 1}`))
          : toHandle(name, `contact.${index + 1}`),
        avatar: isLinkedUser ? resolvedProfile.avatar : item.avatar,
        palette: getInstagramPalette(item.id || name, index),
        location: clipText(pickText(item.name, info.location, resolvedProfile.location, "联系人"), 18),
        signature: getContactPreview(item, resolvedProfile.bio),
        content: clipText(pickText(item.content, item.signature, resolvedProfile.bio), 96),
        online: isLinkedUser ? "在线" : info.online,
        detail: clipText(pickText(item.name, item.signature, item.id), 24),
        isLinkedUser
      };
    });
  }

  function buildStories(actors) {
    const linkedUser = getLinkedUser();
    const resolvedProfile = getResolvedProfile(linkedUser);
    const linkedActor = actors.find((actor) => actor.isLinkedUser) || null;
    return [
      {
        id: "your-story",
        name: `${resolvedProfile.identityName}的故事`,
        own: true,
        seen: false,
        avatar: resolvedProfile.avatar,
        palette: getInstagramPalette(resolvedProfile.identityName, 1)
      },
      ...actors
        .filter((actor) => !linkedActor || actor.id !== linkedActor.id)
        .map((actor, index) => ({
        id: actor.id,
        name: actor.name,
        own: false,
        seen: false,
        avatar: actor.avatar,
        palette: actor.palette
      }))
    ];
  }

  function buildHomePosts(actors) {
    const badges = ["更新", "置顶", "瞬间", "记录", "精选"];
    const ages = ["刚刚", "12 分钟前", "38 分钟前", "1 小时前", "昨天"];
    const total = Math.max(3, Math.min(actors.length + 1, 5));

    return Array.from({ length: total }).map((_, index) => {
      const author = actors[index % actors.length];
      const commenterA = actors[(index + 1) % actors.length];
      const commenterB = actors[(index + 2) % actors.length];
      return {
        id: `post-${author.id}-${index}`,
        badge: author.isLinkedUser ? "在线" : badges[index % badges.length],
        title: getHeadline(author.content, author.name, 16),
        sub: getSubline(author.content, author.signature, `@${author.handle}`, 24),
        likes: seededCount(`${author.id}:${index}`, 4200 + index * 1100, 24000),
        author,
        comments: [
          { user: commenterA.name, text: commenterA.signature },
          { user: commenterB.name, text: commenterB.content }
        ],
        caption: author.content,
        age: ages[index % ages.length]
      };
    });
  }

  function buildReels(actors) {
    const total = Math.max(3, Math.min(actors.length + 1, 5));
    return Array.from({ length: total }).map((_, index) => {
      const actor = actors[index % actors.length];
      return {
        id: `reel-${actor.id}-${index}`,
        hook: getHeadline(actor.signature, actor.name, 12),
        title: getHeadline(actor.content, actor.name, 18),
        likes: seededCount(`${actor.id}:reel:${index}`, 18000 + index * 2600, 78000),
        comments: seededCount(`${actor.id}:comment:${index}`, 600 + index * 180, 4800),
        actor,
        caption: actor.content,
        audio: `${actor.name} · ${getSubline(actor.content, actor.signature, actor.online, 18)}`,
        palette: actor.palette
      };
    });
  }

  function buildConversations(actors) {
    return actors.slice(0, 4).map((actor, index) => ({
      id: `chat-${actor.id}`,
      actor,
      preview: actor.signature,
      time: index === 0 ? "09:18" : index === 1 ? "昨天" : index === 2 ? "周一" : "周日",
      unread: index === 0 ? 2 : index === 2 ? 1 : 0,
      pinned: index === 0
    }));
  }

  function buildMessagesByChat(conversations) {
    const result = {};
    const linkedName = getProfileIdentityName();
    conversations.forEach((conversation, index) => {
      const actor = conversation.actor;
      result[conversation.id] = [
        { side: "left", text: `${actor.name} 的资料已经同步到 Instagram。` },
        { side: "right", text: `已关联 ${linkedName}，顶部故事和在线身份都会同步显示。` },
        {
          side: "left",
          share: {
            badge: actor.name,
            title: actor.signature,
            copy: actor.content
          }
        },
        {
          side: "right",
          text: index % 2 === 0
            ? "个人页头像读取桌面头像，编辑资料和预设也都改成弹窗了。"
            : "统计数字可以单独编辑，预设会把当前 USER 关联一起保存。"
        }
      ];
    });
    return result;
  }

  function buildExploreItems(actors) {
    const labels = ["POST", "REEL", "LIVE", "CLIP", "SAVE", "POST"];
    return labels.map((label, index) => {
      const actor = actors[index % actors.length];
      return {
        id: `explore-${index + 1}`,
        author: actor.name,
        title: getHeadline(actor.content, actor.name, 14),
        type: label,
        metric: index % 2 === 0 ? actor.online : formatCountDisplay(seededCount(`${actor.id}:explore:${index}`, 2400, 11000)),
        palette: actor.palette,
        wide: index % 3 === 1
      };
    });
  }

  function buildProfileHighlights(actors) {
    return actors.slice(0, 4).map((actor, index) => ({
      id: `highlight-${actor.id}`,
      title: clipText(actor.name, 10),
      palette: getInstagramPalette(`highlight:${actor.id}`, index)
    }));
  }

  function buildProfileGridItems(tab, actors) {
    const sizes = {
      posts: 6,
      reels: 3,
      tagged: 3,
      saved: 3
    };
    const badgeMap = {
      posts: "帖子",
      reels: "Reel",
      tagged: "标记",
      saved: "预设"
    };
    const total = sizes[tab] || 3;
    return Array.from({ length: total }).map((_, index) => {
      const actor = actors[index % actors.length];
      const titleSource = tab === "saved" ? actor.signature : actor.content;
      return {
        id: `${tab}-${actor.id}-${index}`,
        badge: actor.isLinkedUser && index === 0 ? "已关联" : badgeMap[tab],
        title: getHeadline(titleSource, actor.name, 12),
        palette: getInstagramPalette(`${tab}:${actor.id}`, index)
      };
    });
  }

  function renderCircleMedia(prefix, name, image) {
    if (image) {
      return `<img class="${prefix}__image" src="${escapeHtml(image)}" alt="${escapeHtml(name)}">`;
    }
    return `<div class="${prefix}__initials">${escapeHtml(initials(name))}</div>`;
  }

  function icon(name, className = "instagram-svg", strokeWidth = 2.1) {
    const svg = (content, fill = "none", weight = strokeWidth) => (
      `<svg viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${className}">${content}</svg>`
    );

    switch (name) {
      case "home":
        return svg('<path d="m4.5 10.8 7.5-6.3 7.5 6.3"/><path d="M6.8 9.8v8.1h10.4V9.8"/>', "none", 2.25);
      case "reels":
        return svg('<rect x="4.2" y="5.1" width="15.6" height="13.8" rx="3.2"/><path d="m9.1 5.3 2.7 3.5"/><path d="m14 5.3 2.8 3.5"/><path d="m10.2 10.9 4.9 3.1-4.9 3.1z" fill="currentColor" stroke="none"/>', "none", 2.2);
      case "send":
        return svg('<path d="M21 3.8 10.9 14.1"/><path d="m21 3.8-6.5 16.1-3.3-7.1-7.1-3.3z"/>', "none", 2.25);
      case "search":
        return svg('<circle cx="11" cy="11" r="6.7"/><path d="m16.1 16.1 4 4"/>', "none", 2.2);
      case "user":
        return svg('<circle cx="12" cy="8.4" r="3.4"/><path d="M5.7 18.6c1.4-2.7 3.6-4.1 6.3-4.1s4.9 1.4 6.3 4.1"/>', "none", 2.2);
      case "heart":
        return svg('<path d="m12 19.3-1.2-1C5.8 13.8 3.2 11.4 3.2 8.3c0-2.4 1.9-4.3 4.2-4.3 1.4 0 2.6.6 3.6 1.8.9-1.2 2.2-1.8 3.6-1.8 2.3 0 4.2 1.9 4.2 4.3 0 3.1-2.6 5.5-7.6 10z"/>', "none", 2.25);
      case "comment":
        return svg('<path d="M5 18.6V7.4A2.2 2.2 0 0 1 7.2 5.2h9.6A2.2 2.2 0 0 1 19 7.4v6.9a2.2 2.2 0 0 1-2.2 2.2H9.5L5 18.6Z"/>', "none", 2.2);
      case "bookmark":
        return svg('<path d="M7.1 5.2c0-.8.7-1.5 1.5-1.5h6.8c.8 0 1.5.7 1.5 1.5v14.8L12 16.7l-4.9 3.3z"/>', "none", 2.2);
      case "more":
        return svg('<circle cx="6.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="17.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>');
      case "bell":
        return svg('<path d="M7 10.1a5 5 0 1 1 10 0v3.3l1.6 2.5H5.4L7 13.4z"/><path d="M10 18.2a2 2 0 0 0 4 0"/>', "none", 2.2);
      case "video":
        return svg('<rect x="3.8" y="6.1" width="11.8" height="11.8" rx="3"/><path d="m15.7 10 4.5-2.5v8.9L15.7 14z"/>', "none", 2.2);
      case "menu":
        return svg('<path d="M4.8 7h14.4"/><path d="M4.8 12h14.4"/><path d="M4.8 17h14.4"/>', "none", 2.25);
      case "grid":
        return svg('<rect x="4.2" y="4.2" width="6.3" height="6.3" rx="1.3"/><rect x="13.5" y="4.2" width="6.3" height="6.3" rx="1.3"/><rect x="4.2" y="13.5" width="6.3" height="6.3" rx="1.3"/><rect x="13.5" y="13.5" width="6.3" height="6.3" rx="1.3"/>', "none", 2.15);
      case "tag":
        return svg('<path d="M20 12.3 11.7 4H5.2v6.5l8.3 8.3z"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none"/>', "none", 2.15);
      case "location":
        return svg('<path d="M12 20.2s5.4-5.7 5.4-10a5.4 5.4 0 1 0-10.8 0c0 4.3 5.4 10 5.4 10Z"/><circle cx="12" cy="10" r="1.8"/>', "none", 2.1);
      case "audio":
        return svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5a8.5 8.5 0 0 1 8.2 6.2"/>', "none", 2.1);
      case "link":
        return svg('<path d="M10.1 13.9 8 16a3 3 0 1 1-4.2-4.2l3.1-3.1a3 3 0 0 1 4.2 0"/><path d="m13.9 10.1 2.1-2.1a3 3 0 1 1 4.2 4.2l-3.1 3.1a3 3 0 0 1-4.2 0"/><path d="m9 15 6-6"/>', "none", 2.1);
      case "camera":
        return svg('<path d="M4.4 7.2h3.3l1.4-2.1h5.8l1.4 2.1h3.3c1 0 1.8.8 1.8 1.8v7.8c0 1-.8 1.8-1.8 1.8H4.4c-1 0-1.8-.8-1.8-1.8V9c0-1 .8-1.8 1.8-1.8Z"/><circle cx="12" cy="13" r="3.5"/>', "none", 2.1);
      case "check":
        return svg('<path d="m7 12.5 3.1 3.1L17 8.8"/>', "none", 2.4);
      case "chevron-left":
        return svg('<path d="m14.5 5.5-6.2 6.5 6.2 6.5"/>', "none", 2.4);
      case "close":
        return svg('<path d="M6 6 18 18"/><path d="M18 6 6 18"/>', "none", 2.35);
      default:
        return svg('<circle cx="12" cy="12" r="8"/>');
    }
  }

  function renderTitleBlock(title, subtitle, action = "") {
    const tag = action ? "button" : "div";
    const attrs = [
      `class="instagram-title-block${action ? " instagram-title-button" : ""}"`
    ];
    if (action) {
      attrs.push('type="button"');
      attrs.push(`data-action="${escapeHtml(action)}"`);
      attrs.push(`aria-label="${escapeHtml(`${title}，退出 Instagram`)}`);
    }

    return `
      <${tag} ${attrs.join(" ")}>
        <span class="instagram-title-button__title">${escapeHtml(title)}</span>
        ${subtitle ? `<span class="instagram-title-button__subtitle">${escapeHtml(subtitle)}</span>` : ""}
      </${tag}>
    `;
  }

  function renderTopbar(options) {
    return `
      <header class="instagram-topbar">
        <div class="instagram-topbar__left">
          ${options.backAction ? `<button type="button" class="instagram-icon-button instagram-icon-button--ghost instagram-icon-button--back" data-action="${escapeHtml(options.backAction)}" aria-label="返回">${icon("chevron-left", "instagram-svg instagram-svg--lg", 2.35)}</button>` : ""}
          ${renderTitleBlock(options.title, options.subtitle || "", options.titleAction || "")}
        </div>
        <div class="instagram-topbar__right">
          ${options.right || ""}
        </div>
      </header>
    `;
  }

  function renderAvatar(name, palette, options = {}) {
    const tag = options.button ? "button" : "div";
    const attrs = [];
    if (options.button) {
      attrs.push('type="button"');
    }
    attrs.push(`class="instagram-avatar${options.size ? ` instagram-avatar--${options.size}` : ""}${options.button ? " instagram-avatar--button" : ""}${options.className ? ` ${options.className}` : ""}"`);
    attrs.push(paletteStyle(options.palette || palette));
    if (options.action) {
      attrs.push(`data-action="${escapeHtml(options.action)}"`);
    }

    return `
      <${tag} ${attrs.join(" ")}>
        <div class="instagram-avatar__inner">
          ${renderCircleMedia("instagram-avatar", name, options.image)}
        </div>
        ${options.plus ? '<span class="instagram-avatar__plus">+</span>' : ""}
      </${tag}>
    `;
  }

  function renderStory(story) {
    return `
      <div class="instagram-story${story.seen ? " instagram-story--seen" : ""}">
        <div class="instagram-story__ring" ${paletteStyle(story.palette)}>
          <div class="instagram-story__inner">
            ${renderCircleMedia("instagram-story", story.name, story.avatar)}
          </div>
          ${story.own ? '<span class="instagram-story__plus">+</span>' : ""}
        </div>
        <span class="instagram-story__name">${escapeHtml(story.name)}</span>
      </div>
    `;
  }

  function renderHome() {
    const actors = buildActors();
    const stories = buildStories(actors);
    const posts = buildHomePosts(actors);
    const resolvedProfile = getResolvedProfile();

    return `
      <section class="instagram-page">
        ${renderTopbar({
          title: "Instagram",
          subtitle: resolvedProfile.identityStatus,
          titleAction: "close-app",
          right: `<button type="button" class="instagram-icon-button instagram-icon-button--ghost" aria-label="消息通知">${icon("bell", "instagram-svg instagram-svg--lg", 2.2)}</button>`
        })}
        <div class="instagram-story-strip">
          <div class="instagram-story-row" data-drag-scroll="x" data-no-swipe="true">
            ${stories.map(renderStory).join("")}
          </div>
        </div>
        <div class="instagram-feed">
          ${posts.map((post) => `
            <article class="instagram-card">
              <div class="instagram-card__header">
                <div class="instagram-card__author">
                  ${renderAvatar(post.author.name, post.author.palette, { size: "sm", image: post.author.avatar })}
                  <div>
                    <div class="instagram-author__name">@${escapeHtml(post.author.handle)}</div>
                    <div class="instagram-author__meta">${escapeHtml(post.author.online)} · ${escapeHtml(post.author.detail)}</div>
                  </div>
                </div>
                <span class="instagram-action-pill" aria-hidden="true">${icon("more", "instagram-svg instagram-svg--sm", 2.3)}</span>
              </div>
              <div class="instagram-media" ${paletteStyle(post.author.palette)}>
                <div class="instagram-media__shade"></div>
                <span class="instagram-media__badge">${escapeHtml(post.badge)}</span>
                <span class="instagram-media__label">${escapeHtml(post.title)}</span>
                <span class="instagram-media__sub">${escapeHtml(post.sub)}</span>
              </div>
              <div class="instagram-card__actions">
                <div class="instagram-card__action-group">
                  <span class="instagram-action-pill">${icon("heart", "instagram-svg instagram-svg--action", 2.3)}</span>
                  <span class="instagram-action-pill">${icon("comment", "instagram-svg instagram-svg--action", 2.25)}</span>
                  <span class="instagram-action-pill">${icon("send", "instagram-svg instagram-svg--action", 2.35)}</span>
                </div>
                <span class="instagram-action-pill">${icon("bookmark", "instagram-svg instagram-svg--action", 2.25)}</span>
              </div>
              <div class="instagram-card__footer">
                <div class="instagram-like-line">${escapeHtml(formatCountDisplay(post.likes))} 次赞</div>
                <div class="instagram-caption"><strong>@${escapeHtml(post.author.handle)}</strong> ${escapeHtml(post.caption)}</div>
                <div class="instagram-comment-preview">
                  ${post.comments.map((comment) => `<div><strong>${escapeHtml(comment.user)}</strong> ${escapeHtml(comment.text)}</div>`).join("")}
                </div>
                <div class="instagram-card__age">${escapeHtml(post.age)}</div>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderReels() {
    const reels = buildReels(buildActors());
    const reel = reels[state.reelIndex % reels.length];
    const resolvedProfile = getResolvedProfile();

    return `
      <section class="instagram-reel-view">
        ${renderTopbar({
          title: "Reels",
          subtitle: resolvedProfile.identityStatus,
          titleAction: "close-app",
          right: `<button type="button" class="instagram-icon-button instagram-icon-button--ghost" aria-label="搜索">${icon("search", "instagram-svg instagram-svg--lg", 2.2)}</button>`
        })}
        <article class="instagram-reel" ${paletteStyle(reel.palette)}>
          <div class="instagram-reel__frame">
            <div class="instagram-reel__shade"></div>
          </div>
          <div class="instagram-reel__content">
            <div class="instagram-reel__bottom">
              <span class="instagram-reel__hint">${escapeHtml(reel.hook)}</span>
              <h2 class="instagram-reel__title">${escapeHtml(reel.title)}</h2>
              <div class="instagram-reel__copy"><strong>${escapeHtml(reel.actor.name)}</strong> ${escapeHtml(reel.caption)}</div>
              <div class="instagram-reel__audio">${icon("audio", "instagram-svg instagram-svg--sm", 2.2)} ${escapeHtml(reel.audio)}</div>
            </div>
            <div class="instagram-reel__actions">
              ${renderAvatar(reel.actor.name, reel.actor.palette, { image: reel.actor.avatar, plus: true })}
              <div class="instagram-reel__metric">
                <span class="instagram-action-pill">${icon("heart", "instagram-svg instagram-svg--action", 2.3)}</span>
                <span>${escapeHtml(formatCountDisplay(reel.likes))}</span>
              </div>
              <div class="instagram-reel__metric">
                <span class="instagram-action-pill">${icon("comment", "instagram-svg instagram-svg--action", 2.25)}</span>
                <span>${escapeHtml(formatCountDisplay(reel.comments))}</span>
              </div>
              <div class="instagram-reel__metric">
                <span class="instagram-action-pill">${icon("send", "instagram-svg instagram-svg--action", 2.35)}</span>
                <span>私信</span>
              </div>
              <div class="instagram-reel__metric">
                <span class="instagram-action-pill">${icon("bookmark", "instagram-svg instagram-svg--action", 2.25)}</span>
                <span>收藏</span>
              </div>
              <div class="instagram-audio-disc" aria-hidden="true"></div>
            </div>
          </div>
        </article>
        <div class="instagram-reel__nav">
          <button type="button" class="instagram-pill-button" data-action="reel-prev">上一条</button>
          <button type="button" class="instagram-pill-button" data-action="reel-next">下一条</button>
        </div>
      </section>
    `;
  }

  function renderDMs() {
    const conversations = buildConversations(buildActors());
    const messagesByChat = buildMessagesByChat(conversations);

    if (state.dmChatId) {
      const activeConversation = conversations.find((item) => item.id === state.dmChatId) || conversations[0];
      const messages = messagesByChat[activeConversation.id] || [];

      return `
        <section class="instagram-dm-page">
          ${renderTopbar({
            title: activeConversation.actor.name,
            subtitle: activeConversation.actor.online,
            backAction: "go-back"
          })}
          <div class="instagram-chat">
            <div class="instagram-chat__window">
              ${messages.map((message) => (
                message.share ? `
                  <div class="instagram-message instagram-message--${message.side}">
                    <div class="instagram-chat-share">
                      <div class="instagram-chat-share__cover" ${paletteStyle(activeConversation.actor.palette)}></div>
                      <strong>${escapeHtml(message.share.badge)}</strong>
                      <div style="margin-top: 6px;">${escapeHtml(message.share.title)}</div>
                      <div class="instagram-muted" style="margin-top: 6px; font-size: 12px;">${escapeHtml(message.share.copy)}</div>
                    </div>
                  </div>
                ` : `
                  <div class="instagram-message instagram-message--${message.side}">${escapeHtml(message.text)}</div>
                `
              )).join("")}
            </div>
            <div class="instagram-chat__composer" data-no-swipe="true">
              <button type="button" class="instagram-icon-button instagram-icon-button--ghost" aria-label="表情">${icon("heart", "instagram-svg instagram-svg--action", 2.3)}</button>
              <input type="text" placeholder="发送消息">
              <button type="button" class="instagram-icon-button instagram-icon-button--ghost" aria-label="相机">${icon("camera", "instagram-svg instagram-svg--action", 2.15)}</button>
              <button type="button" class="instagram-icon-button instagram-icon-button--ghost" aria-label="语音">${icon("audio", "instagram-svg instagram-svg--action", 2.15)}</button>
              <button type="button" class="instagram-icon-button" aria-label="发送">${icon("send", "instagram-svg instagram-svg--action", 2.35)}</button>
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="instagram-dm-page">
        ${renderTopbar({
          title: "私信",
          subtitle: `${conversations.length} 位联系人`,
          titleAction: "close-app",
          right: `<button type="button" class="instagram-icon-button instagram-icon-button--ghost" aria-label="视频通话">${icon("video", "instagram-svg instagram-svg--lg", 2.2)}</button>`
        })}
        <div class="instagram-search-wrap">
          ${icon("search", "instagram-svg instagram-svg--sm", 2.2)}
          <input class="instagram-conversation-search" type="search" placeholder="搜索对话、联系人、内容">
        </div>
        <div class="instagram-list">
          ${conversations.map((item) => `
            <button type="button" class="instagram-conversation${item.pinned ? " instagram-conversation--pinned" : ""}" data-action="open-chat" data-chat-id="${escapeHtml(item.id)}">
              ${renderAvatar(item.actor.name, item.actor.palette, { image: item.actor.avatar })}
              <div class="instagram-conversation__body">
                <div class="instagram-conversation__title">${escapeHtml(item.actor.name)}</div>
                <div class="instagram-conversation__meta">${escapeHtml(item.preview)}</div>
              </div>
              <div class="instagram-conversation__time">
                <span>${escapeHtml(item.time)}</span>
                ${item.unread ? `<span class="instagram-unread">${item.unread}</span>` : ""}
              </div>
            </button>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderSearch() {
    const actors = buildActors();
    const conversations = buildConversations(actors);
    const exploreItems = buildExploreItems(actors);
    const query = state.searchQuery.trim().toLowerCase();

    const filteredUsers = conversations.filter((item) => {
      const target = `${item.actor.name} ${item.preview} ${item.actor.detail}`.toLowerCase();
      return target.includes(query);
    });

    const filteredExplore = exploreItems.filter((item) => {
      const target = `${item.author} ${item.title} ${item.type}`.toLowerCase();
      return target.includes(query);
    });

    return `
      <section class="instagram-search-page">
        ${renderTopbar({
          title: "搜索",
          subtitle: "联系人、USER 身份与主页内容",
          titleAction: "close-app"
        })}
        <div class="instagram-search-wrap">
          ${icon("search", "instagram-svg instagram-svg--sm", 2.2)}
          <input class="instagram-searchbar" data-focus-key="search" type="search" value="${escapeHtml(state.searchQuery)}" placeholder="搜索联系人、标签、地点、内容">
        </div>
        ${query ? `
          <div class="instagram-chip-row">
            ${["热门", "用户", "标签", "地点", "音频"].map((label, index) => `
              <button type="button" class="instagram-chip${index === 0 ? " instagram-chip--active" : ""}" data-action="search-chip" data-value="${escapeHtml(query)}">${escapeHtml(label)}</button>
            `).join("")}
          </div>
          <div class="instagram-results-panel instagram-panel">
            <div class="instagram-search-results">
              ${filteredUsers.map((item) => `
                <div class="instagram-result-row">
                  ${renderAvatar(item.actor.name, item.actor.palette, { size: "sm", image: item.actor.avatar })}
                  <div>
                    <div class="instagram-conversation__title">${escapeHtml(item.actor.name)}</div>
                    <div class="instagram-result-row__meta">${escapeHtml(item.preview)}</div>
                  </div>
                  <span class="instagram-result-row__metric">DM</span>
                </div>
              `).join("")}
              ${filteredExplore.map((item) => `
                <div class="instagram-result-row">
                  <div class="instagram-avatar instagram-avatar--sm" ${paletteStyle(item.palette)}>
                    <div class="instagram-avatar__inner">
                      <div class="instagram-avatar__initials">${escapeHtml(initials(item.title))}</div>
                    </div>
                  </div>
                  <div>
                    <div class="instagram-conversation__title">${escapeHtml(item.title)}</div>
                    <div class="instagram-result-row__meta">${escapeHtml(item.author)} · ${escapeHtml(item.type)}</div>
                  </div>
                  <span class="instagram-result-row__metric">${escapeHtml(item.metric)}</span>
                </div>
              `).join("")}
              ${!filteredUsers.length && !filteredExplore.length ? '<div class="instagram-empty">没有更精确的匹配结果。</div>' : ""}
            </div>
          </div>
        ` : `
          <div class="instagram-chip-row">
            ${["联系人", "角色", "标签", "地点", "音频"].map((label, index) => `
              <button type="button" class="instagram-chip${index === 0 ? " instagram-chip--active" : ""}" data-action="search-chip" data-value="${escapeHtml(label)}">${escapeHtml(label)}</button>
            `).join("")}
          </div>
          <div class="instagram-explore-grid">
            ${exploreItems.map((item) => `
              <article class="instagram-explore-card">
                <div class="instagram-explore-card__cover${item.wide ? " instagram-explore-card__cover--wide" : ""}" ${paletteStyle(item.palette)}>
                  <div class="instagram-explore-card__shade"></div>
                  <span class="instagram-explore-card__badge">${escapeHtml(item.metric)}</span>
                  <span class="instagram-explore-card__title">${escapeHtml(item.title)}</span>
                </div>
                <div class="instagram-explore-card__meta">
                  <div class="instagram-explore-card__author">${escapeHtml(item.author)}</div>
                  <div class="instagram-explore-card__type">${escapeHtml(item.type)}</div>
                </div>
              </article>
            `).join("")}
          </div>
        `}
      </section>
    `;
  }

  function renderProfileStats() {
    return statOrder.map((key) => {
      const display = formatCountDisplay(profile.stats[key]);
      return `
        <button type="button" class="instagram-profile-stat" data-action="open-stat-editor" data-stat-key="${escapeHtml(key)}">
          <strong class="${getCountClassName(display)}">${escapeHtml(display)}</strong>
          <span>${escapeHtml(statLabels[key])}</span>
        </button>
      `;
    }).join("");
  }

  function renderProfile() {
    const actors = buildActors();
    const items = buildProfileGridItems(state.profileTab, actors);
    const highlights = buildProfileHighlights(actors);
    const linkedUser = getLinkedUser();
    const resolvedProfile = getResolvedProfile(linkedUser);
    const linkedSummary = linkedUser
      ? getContactPreview(linkedUser, linkedUser.id)
      : "在设置里选择一个 USER 身份后，这里会同步昵称和故事。";

    return `
      <section class="instagram-profile-page">
        ${renderTopbar({
          title: `@${resolvedProfile.username}`,
          subtitle: resolvedProfile.identityStatus,
          titleAction: "close-app",
          right: `<button type="button" class="instagram-icon-button instagram-icon-button--ghost" data-action="open-profile-settings" aria-label="资料设置">${icon("menu", "instagram-svg instagram-svg--lg", 2.25)}</button>`
        })}
        <div class="instagram-profile-card">
          <div class="instagram-profile-head">
            <div class="instagram-profile-head__top">
              ${renderAvatar(profile.name, ["#0a84ff", "#8fd6ff"], {
                size: "xl",
                image: resolvedProfile.avatar,
                className: "instagram-avatar--profile"
              })}
              <div class="instagram-profile-stats">
                ${renderProfileStats()}
              </div>
            </div>
            <div class="instagram-profile-bio">
              <h2>${escapeHtml(resolvedProfile.name)} <span class="instagram-check">${icon("check", "instagram-svg instagram-svg--sm", 2.4)}</span></h2>
              <div class="instagram-profile-linked">
                <span class="instagram-profile-linked__eyebrow">关联 USER 身份</span>
                <strong>${escapeHtml(linkedUser ? resolvedProfile.identityName : "未选择 USER 身份")}</strong>
                <small>${escapeHtml(linkedSummary)}</small>
              </div>
              <p>${escapeHtmlWithBreaks(resolvedProfile.bio)}</p>
              <a href="javascript:void(0)">${icon("link", "instagram-svg instagram-svg--sm", 2.15)} ${escapeHtml(resolvedProfile.link)}</a>
              <p>${icon("location", "instagram-svg instagram-svg--sm", 2.1)} ${escapeHtml(resolvedProfile.location)}</p>
            </div>
            <div class="instagram-profile-actions">
              <button type="button" class="is-secondary" data-action="open-profile-editor">编辑资料</button>
              <button type="button" class="is-primary" data-action="open-profile-dm">私信</button>
            </div>
          </div>
        </div>
        <div class="instagram-highlight-row" data-drag-scroll="x" data-no-swipe="true">
          ${highlights.map((item) => `
            <div class="instagram-highlight">
              <div class="instagram-highlight__cover" ${paletteStyle(item.palette)}>
                <div>${escapeHtml(initials(item.title))}</div>
              </div>
              <span class="instagram-story__name">${escapeHtml(item.title)}</span>
            </div>
          `).join("")}
        </div>
        <div class="instagram-segmented">
          ${profileTabs.map((tab) => `
            <button type="button" class="${state.profileTab === tab.id ? "is-active" : ""}" data-action="switch-profile-tab" data-profile-tab="${escapeHtml(tab.id)}" aria-label="${escapeHtml(tab.label)}">
              ${icon(tab.icon, "instagram-svg instagram-svg--tab", 2.25)}
            </button>
          `).join("")}
        </div>
        ${items.length ? `
          <div class="instagram-grid">
            ${items.map((item) => `
              <article class="instagram-grid-card" ${paletteStyle(item.palette)}>
                <div class="instagram-grid-card__shade"></div>
                <span class="instagram-grid-card__badge">${escapeHtml(item.badge)}</span>
                <span class="instagram-grid-card__title">${escapeHtml(item.title)}</span>
              </article>
            `).join("")}
          </div>
        ` : '<div class="instagram-empty">当前分栏暂无内容。</div>'}
      </section>
    `;
  }

  function getPresetBaseProfile() {
    const draftSource = state.profileEditorOpen && state.profileDraft
      ? state.profileDraft
      : profile;

    return normalizeProfile({
      ...profile,
      ...draftSource,
      linkedUserId: pickText(state.settingsDraft?.linkedUserId, draftSource?.linkedUserId, profile.linkedUserId)
    });
  }

  function renderPresetSection() {
    const userContacts = getUserContacts();
    const sourceProfile = getPresetBaseProfile();
    const selectedUser = userContacts.find((item) => item.id === sourceProfile.linkedUserId) || null;

    return `
      <div class="instagram-editor-section">
        <div class="instagram-editor-section__header">
          <strong>资料预设</strong>
          <small>把当前资料另存为预设，之后可以一键套用。</small>
        </div>
        <div class="instagram-profile-linked instagram-preset-summary">
          <span class="instagram-profile-linked__eyebrow">当前预设绑定</span>
          <strong>${escapeHtml(getContactDisplayName(selectedUser, pickText(sourceProfile.name, sourceProfile.username, "资料预设")))}</strong>
          <small>${escapeHtml(selectedUser ? `${getContactPreview(selectedUser, selectedUser.id)} · 会和当前资料一起保存。` : "当前未绑定 USER，预设会按现有资料保存。")}</small>
        </div>
        <div class="instagram-field">
          <label for="instagram-preset-name">保存为预设</label>
          <input id="instagram-preset-name" class="instagram-input" data-focus-key="preset-name" data-settings-field="presetDraftName" type="text" value="${escapeHtml(state.presetDraftName)}" placeholder="例如：主号 / 剧情号 / 工作号">
        </div>
        <div class="instagram-modal__inline-actions">
          <button type="button" class="instagram-pill-button instagram-pill-button--muted" data-action="save-profile-preset">另存为预设</button>
        </div>
        <div class="instagram-preset-list">
          ${profilePresets.length ? profilePresets.map((preset) => `
            <div class="instagram-preset-item">
              <div class="instagram-preset-item__body">
                <strong>${escapeHtml(preset.name)}</strong>
                <small>${escapeHtml(preset.profile.username)} · ${escapeHtml(getContactDisplayName(userContacts.find((item) => item.id === preset.profile.linkedUserId), "未关联 USER"))}</small>
              </div>
              <div class="instagram-preset-item__actions">
                <button type="button" class="instagram-chip" data-action="apply-profile-preset" data-preset-id="${escapeHtml(preset.id)}">应用</button>
                <button type="button" class="instagram-chip" data-action="delete-profile-preset" data-preset-id="${escapeHtml(preset.id)}">删除</button>
              </div>
            </div>
          `).join("") : '<div class="instagram-empty">还没有保存任何资料预设。</div>'}
        </div>
      </div>
    `;
  }

  function renderEditorField(label, field, multiline = false) {
    const value = state.profileDraft ? state.profileDraft[field] || "" : "";
    return `
      <div class="instagram-field">
        <label for="instagram-profile-${escapeHtml(field)}">${escapeHtml(label)}</label>
        ${multiline ? `
          <textarea id="instagram-profile-${escapeHtml(field)}" class="instagram-textarea" data-profile-field="${escapeHtml(field)}" data-focus-key="profile-${escapeHtml(field)}">${escapeHtml(value)}</textarea>
        ` : `
          <input id="instagram-profile-${escapeHtml(field)}" class="instagram-input" data-profile-field="${escapeHtml(field)}" data-focus-key="profile-${escapeHtml(field)}" type="text" value="${escapeHtml(value)}">
        `}
      </div>
    `;
  }

  function renderModalFrame(title, subtitle, body, footer, closeAction = "go-back") {
    return `
      <div class="instagram-modal" data-no-swipe="true">
        <div class="instagram-modal__backdrop"></div>
        <section class="instagram-modal__card instagram-editor-panel">
          <div class="instagram-modal__header">
            <div class="instagram-modal__title-wrap">
              <div class="instagram-modal__title">${escapeHtml(title)}</div>
              ${subtitle ? `<div class="instagram-modal__subtitle">${escapeHtml(subtitle)}</div>` : ""}
            </div>
            <button type="button" class="instagram-icon-button instagram-icon-button--ghost" data-action="${escapeHtml(closeAction)}" aria-label="关闭">${icon("close", "instagram-svg instagram-svg--lg", 2.2)}</button>
          </div>
          <div class="instagram-modal__body">
            ${body}
          </div>
          ${footer ? `<div class="instagram-modal__footer">${footer}</div>` : ""}
        </section>
      </div>
    `;
  }

  function renderPromptModal(title, body, footer) {
    return `
      <div class="instagram-modal instagram-modal--prompt" data-no-swipe="true">
        <div class="instagram-modal__backdrop instagram-modal__backdrop--prompt" data-action="go-back"></div>
        <section class="instagram-prompt-card">
          <div class="instagram-prompt-card__header">
            <h3 class="instagram-prompt-card__title">${escapeHtml(title)}</h3>
          </div>
          <div class="instagram-prompt-card__body">
            ${body}
          </div>
          <div class="instagram-prompt-card__footer">
            ${footer}
          </div>
        </section>
      </div>
    `;
  }

  function renderProfileEditor() {
    const draftProfile = getPresetBaseProfile();
    const linkedUser = getUserContacts().find((item) => item.id === draftProfile.linkedUserId) || null;
    const resolvedProfile = {
      ...draftProfile,
      avatar: desktopAvatar || draftProfile.avatar || linkedUser?.avatar || "",
      identityName: getContactDisplayName(linkedUser, pickText(draftProfile.name, draftProfile.username, "USER"))
    };

    return renderPromptModal(
      "编辑资料",
      `
        <div class="instagram-editor-form">
          <div class="instagram-editor-section">
            <div class="instagram-editor-avatar">
              ${renderAvatar(resolvedProfile.identityName, ["#0a84ff", "#8fd6ff"], {
                size: "xl",
                image: resolvedProfile.avatar,
                className: "instagram-avatar--profile"
              })}
              <div class="instagram-editor-avatar__hint">头像跟随当前主页头像显示。</div>
            </div>
            <div class="instagram-form-grid">
              ${renderEditorField("用户名", "username")}
              ${renderEditorField("昵称", "name")}
              ${renderEditorField("简介", "bio", true)}
              ${renderEditorField("链接", "link")}
              ${renderEditorField("位置", "location")}
            </div>
          </div>
          ${renderPresetSection()}
        </div>
      `,
      `
        <button type="button" class="instagram-prompt-card__button instagram-prompt-card__button--secondary" data-action="go-back">取消</button>
        <button type="button" class="instagram-prompt-card__button instagram-prompt-card__button--primary" data-action="save-profile">保存</button>
      `
    );
  }

  function renderProfileSettings() {
    const userContacts = getUserContacts();
    const draft = state.settingsDraft || { linkedUserId: userContacts[0]?.id || "" };

    return renderModalFrame(
      "资料设置",
      "管理 USER 关联与资料预设",
      `
        <div class="instagram-editor-form">
          <div class="instagram-editor-section">
            <div class="instagram-field">
              <label>关联 USER 身份</label>
              ${userContacts.length ? `
                <div class="instagram-user-grid">
                  ${userContacts.map((user, index) => `
                    <button type="button" class="instagram-user-option${draft.linkedUserId === user.id ? " is-active" : ""}" data-action="select-linked-user" data-user-id="${escapeHtml(user.id)}">
                      ${renderAvatar(getContactDisplayName(user, "USER"), getInstagramPalette(user.id, index), { size: "sm", image: user.avatar || getProfileAvatar(user) })}
                      <div class="instagram-user-option__body">
                        <strong>${escapeHtml(getContactDisplayName(user, "USER"))}</strong>
                        <small>${escapeHtml(getContactPreview(user, user.id))}</small>
                      </div>
                    </button>
                  `).join("")}
                </div>
              ` : '<div class="instagram-empty">先在 CONTACT 里创建 USER 身份，资料页才能关联。</div>'}
              <div class="instagram-form-helper">选中的 USER 会同步顶部在线身份和“某某的故事”，个人头像仍然读取桌面头像。</div>
            </div>
          </div>
          ${renderPresetSection()}
        </div>
      `,
      `
        <button type="button" class="instagram-pill-button instagram-pill-button--muted" data-action="go-back">关闭</button>
        <button type="button" class="instagram-pill-button" data-action="save-settings">保存设置</button>
      `
    );
  }

  function renderStatEditor() {
    const key = state.statEditor || "posts";
    const preview = formatStatPreview(state.statDraft);

    return renderModalFrame(
      `编辑${statLabels[key]}`,
      "支持数字和中文单位混输",
      `
        <div class="instagram-editor-form">
          <div class="instagram-form-grid">
            <div class="instagram-field">
              <label for="instagram-stat-input">${escapeHtml(statLabels[key])}</label>
              <input id="instagram-stat-input" class="instagram-input" data-stat-input="true" data-focus-key="stat-editor" type="text" value="${escapeHtml(state.statDraft)}" placeholder="例如 12000、1.2w、1.2万">
            </div>
            <div class="instagram-stat-preview" data-stat-preview>
              <div class="instagram-stat-preview__value">${escapeHtml(preview.display)}</div>
              <div class="instagram-stat-preview__hint">${escapeHtml(preview.detail)}</div>
            </div>
            <div class="instagram-form-helper">输入纯数字会自动压缩成中文单位显示，输入带单位也会自动识别真实数量。</div>
          </div>
        </div>
      `,
      `
        <button type="button" class="instagram-pill-button instagram-pill-button--muted" data-action="go-back">取消</button>
        <button type="button" class="instagram-pill-button" data-action="save-stat">保存</button>
      `
    );
  }

  function renderNav() {
    if (state.dmChatId || state.profileEditorOpen || state.profileSettingsOpen || state.statEditor) {
      return "";
    }

    const items = [
      { id: "home", label: "Home", icon: "home" },
      { id: "reels", label: "Reels", icon: "reels" },
      { id: "dms", label: "DMs", icon: "send" },
      { id: "search", label: "Search", icon: "search" },
      { id: "profile", label: "Profile", icon: "user" }
    ];

    return `
      <nav class="instagram-nav">
        ${items.map((item) => `
          <button type="button" class="instagram-nav__item${state.tab === item.id ? " is-active" : ""}" data-action="switch-tab" data-tab="${escapeHtml(item.id)}">
            ${icon(item.icon, "instagram-svg instagram-svg--nav", 2.3)}
            <span>${escapeHtml(item.label)}</span>
          </button>
        `).join("")}
      </nav>
    `;
  }

  function renderCurrentTab() {
    switch (state.tab) {
      case "reels":
        return renderReels();
      case "dms":
        return renderDMs();
      case "search":
        return renderSearch();
      case "profile":
        return renderProfile();
      case "home":
      default:
        return renderHome();
    }
  }

  function renderOverlays() {
    return [
      state.profileEditorOpen ? renderProfileEditor() : "",
      state.profileSettingsOpen ? renderProfileSettings() : "",
      state.statEditor ? renderStatEditor() : ""
    ].join("");
  }

  function captureFocus() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !active.dataset.focusKey) {
      return null;
    }
    return {
      key: active.dataset.focusKey,
      start: typeof active.selectionStart === "number" ? active.selectionStart : null,
      end: typeof active.selectionEnd === "number" ? active.selectionEnd : null
    };
  }

  function restoreFocus(saved) {
    if (!saved?.key) {
      return;
    }

    const target = app.querySelector(`[data-focus-key="${saved.key}"]`);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.focus();
    if ("setSelectionRange" in target && typeof saved.start === "number") {
      target.setSelectionRange(saved.start, saved.end ?? saved.start);
    }
  }

  function render() {
    const focus = captureFocus();
    app.innerHTML = `
      <div class="instagram-shell">
        <div class="instagram-shell__content">
          ${renderCurrentTab()}
        </div>
        ${renderNav()}
        ${renderOverlays()}
      </div>
    `;
    restoreFocus(focus);
  }

  function getSnapshot() {
    return {
      tab: state.tab,
      reelIndex: state.reelIndex,
      dmChatId: state.dmChatId,
      profileTab: state.profileTab,
      searchQuery: state.searchQuery,
      profileEditorOpen: state.profileEditorOpen,
      profileDraft: state.profileDraft ? cloneValue(state.profileDraft) : null,
      profileSettingsOpen: state.profileSettingsOpen,
      settingsDraft: state.settingsDraft ? cloneValue(state.settingsDraft) : null,
      presetDraftName: state.presetDraftName,
      statEditor: state.statEditor,
      statDraft: state.statDraft
    };
  }

  function restoreSnapshot(snapshot) {
    state.tab = snapshot.tab;
    state.reelIndex = snapshot.reelIndex;
    state.dmChatId = snapshot.dmChatId;
    state.profileTab = snapshot.profileTab;
    state.searchQuery = snapshot.searchQuery;
    state.profileEditorOpen = snapshot.profileEditorOpen;
    state.profileDraft = snapshot.profileDraft ? cloneValue(snapshot.profileDraft) : null;
    state.profileSettingsOpen = Boolean(snapshot.profileSettingsOpen);
    state.settingsDraft = snapshot.settingsDraft ? cloneValue(snapshot.settingsDraft) : null;
    state.presetDraftName = snapshot.presetDraftName || "";
    state.statEditor = snapshot.statEditor;
    state.statDraft = snapshot.statDraft;
  }

  function pushHistory() {
    state.history.push(getSnapshot());
    if (state.history.length > 24) {
      state.history.shift();
    }
  }

  function clearNestedViews() {
    state.dmChatId = null;
    state.profileEditorOpen = false;
    state.profileDraft = null;
    state.profileSettingsOpen = false;
    state.settingsDraft = null;
    state.presetDraftName = "";
    state.statEditor = null;
    state.statDraft = "";
  }

  function closeInstagramApp() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ app: "instagram", type: "close" }, "*");
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "../../index.html";
  }

  function goBack() {
    const previous = state.history.pop();
    if (previous) {
      restoreSnapshot(previous);
      render();
      return;
    }

    if (state.tab !== "home" || state.dmChatId || state.profileEditorOpen || state.statEditor) {
      state.tab = "home";
      clearNestedViews();
      render();
      return;
    }
  }

  function switchTab(tab) {
    if (state.tab === tab && !state.dmChatId && !state.profileEditorOpen && !state.profileSettingsOpen && !state.statEditor) {
      return;
    }

    pushHistory();
    clearNestedViews();
    state.tab = tab;
    render();
  }

  function switchTabByOffset(offset) {
    if (state.dmChatId || state.profileEditorOpen || state.profileSettingsOpen || state.statEditor) {
      return;
    }

    const order = ["home", "reels", "dms", "search", "profile"];
    const currentIndex = order.indexOf(state.tab);
    const nextIndex = currentIndex + offset;

    if (nextIndex < 0 || nextIndex >= order.length) {
      return;
    }

    switchTab(order[nextIndex]);
  }

  function shiftReel(offset) {
    const reels = buildReels(buildActors());
    state.reelIndex = (state.reelIndex + offset + reels.length) % reels.length;
    render();
  }

  function chooseImage(onLoad) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          onLoad(reader.result);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function persistProfile() {
    await setItem("instagram_profile", normalizeProfile(profile));
  }

  function normalizeProfilePreset(input, index = 0) {
    const source = input && typeof input === "object" ? input : {};
    return {
      id: pickText(source.id, `preset-${index + 1}`),
      name: pickText(source.name, `资料预设 ${index + 1}`),
      profile: normalizeProfile(source.profile),
      updatedAt: pickText(source.updatedAt, new Date().toISOString())
    };
  }

  async function persistProfilePresets() {
    await setItem("instagram_profile_presets", profilePresets.map((preset, index) => normalizeProfilePreset(preset, index)));
  }

  async function refreshExternalData(shouldRender = true) {
    try {
      const storedContacts = await getItem("contacts");
      const storedProfile = await getItem("instagram_profile");
      const storedPresets = await getItem("instagram_profile_presets");
      const storedDesktopAvatar = await getItem("avatar1");
      contacts = Array.isArray(storedContacts) ? storedContacts.map(normalizeContact) : [];
      desktopAvatar = typeof storedDesktopAvatar === "string" ? storedDesktopAvatar : "";
      if (storedProfile) {
        profile = normalizeProfile(storedProfile);
      }
      profilePresets = Array.isArray(storedPresets) ? storedPresets.map(normalizeProfilePreset) : [];
    } catch (error) {
      contacts = [];
      profilePresets = [];
    }
    if (shouldRender) {
      render();
    }
  }

  app.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;
    if (!action) {
      return;
    }

    switch (action) {
      case "close-app":
        closeInstagramApp();
        break;
      case "go-back":
        goBack();
        break;
      case "switch-tab":
        switchTab(target.dataset.tab || "home");
        break;
      case "open-chat":
        pushHistory();
        state.tab = "dms";
        state.dmChatId = target.dataset.chatId || "";
        render();
        break;
      case "switch-profile-tab":
        state.profileTab = target.dataset.profileTab || "posts";
        render();
        break;
      case "search-chip":
        state.searchQuery = target.dataset.value || "";
        render();
        break;
      case "reel-prev":
        shiftReel(-1);
        break;
      case "reel-next":
        shiftReel(1);
        break;
      case "open-profile-editor":
        pushHistory();
        state.profileEditorOpen = true;
        state.profileDraft = cloneValue(profile);
        state.presetDraftName = `${getProfileIdentityName()} 预设`;
        render();
        break;
      case "open-profile-settings":
        pushHistory();
        state.profileSettingsOpen = true;
        state.settingsDraft = {
          linkedUserId: pickText(profile.linkedUserId, getUserContacts()[0]?.id)
        };
        state.presetDraftName = `${getProfileIdentityName()} 预设`;
        render();
        break;
      case "open-profile-dm":
        switchTab("dms");
        break;
      case "select-linked-user":
        if (!state.settingsDraft) {
          return;
        }
        state.settingsDraft.linkedUserId = target.dataset.userId || "";
        render();
        break;
      case "save-settings":
        if (!state.settingsDraft) {
          return;
        }
        profile = normalizeProfile({
          ...profile,
          linkedUserId: state.settingsDraft.linkedUserId
        });
        await persistProfile();
        goBack();
        break;
      case "save-profile-preset": {
        const presetProfile = getPresetBaseProfile();
        const selectedUser = getUserContacts().find((item) => item.id === presetProfile.linkedUserId) || null;
        const preset = normalizeProfilePreset({
          id: `preset-${Date.now().toString(36)}`,
          name: pickText(state.presetDraftName, `${getContactDisplayName(selectedUser, pickText(presetProfile.name, presetProfile.username, "资料"))} 预设`),
          profile: presetProfile,
          updatedAt: new Date().toISOString()
        }, profilePresets.length);
        profilePresets = [preset, ...profilePresets].slice(0, 12);
        await persistProfilePresets();
        state.presetDraftName = preset.name;
        render();
        break;
      }
      case "apply-profile-preset": {
        const preset = profilePresets.find((item) => item.id === target.dataset.presetId);
        if (!preset) {
          return;
        }
        if (state.profileEditorOpen) {
          state.profileDraft = cloneValue(preset.profile);
          state.presetDraftName = preset.name;
          render();
          break;
        }
        profile = normalizeProfile(preset.profile);
        await persistProfile();
        if (state.profileSettingsOpen) {
          state.settingsDraft = {
            linkedUserId: pickText(profile.linkedUserId, getUserContacts()[0]?.id)
          };
          state.presetDraftName = preset.name;
          render();
          break;
        }
        goBack();
        break;
      }
      case "delete-profile-preset":
        profilePresets = profilePresets.filter((item) => item.id !== target.dataset.presetId);
        await persistProfilePresets();
        render();
        break;
      case "save-profile":
        if (!state.profileDraft) {
          return;
        }
        profile = normalizeProfile({
          ...profile,
          ...state.profileDraft
        });
        await persistProfile();
        goBack();
        break;
      case "open-stat-editor":
        pushHistory();
        state.statEditor = target.dataset.statKey || "posts";
        state.statDraft = String(profile.stats[state.statEditor] ?? "");
        render();
        break;
      case "save-stat": {
        if (!state.statEditor) {
          return;
        }
        const parsed = parseCountInput(state.statDraft);
        if (parsed === null) {
          render();
          return;
        }
        profile = normalizeProfile({
          ...profile,
          stats: {
            ...profile.stats,
            [state.statEditor]: parsed
          }
        });
        await persistProfile();
        goBack();
        break;
      }
      default:
        break;
    }
  });

  app.addEventListener("input", (event) => {
    const target = event.target;

    if (target instanceof HTMLInputElement && target.dataset.focusKey === "search") {
      state.searchQuery = target.value;
      render();
      return;
    }

    if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && target.dataset.profileField && state.profileDraft) {
      state.profileDraft[target.dataset.profileField] = target.value;
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.settingsField === "presetDraftName") {
      state.presetDraftName = target.value;
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.statInput) {
      state.statDraft = target.value;
      render();
    }
  });

  function shouldBlockSwipe(target) {
    return target instanceof Element && Boolean(target.closest("input, textarea, button, [data-no-swipe], [data-drag-scroll='x']"));
  }

  app.addEventListener("pointerdown", (event) => {
    const rail = event.target instanceof Element ? event.target.closest("[data-drag-scroll='x']") : null;
    if (rail instanceof HTMLElement && event.pointerType === "mouse") {
      dragRail = {
        element: rail,
        pointerId: event.pointerId,
        startX: event.clientX,
        scrollLeft: rail.scrollLeft
      };
      rail.classList.add("is-dragging");
      return;
    }

    if (event.pointerType === "mouse") {
      pointerStart = null;
      return;
    }

    if (state.profileEditorOpen || state.profileSettingsOpen || state.statEditor || shouldBlockSwipe(event.target)) {
      pointerStart = null;
      return;
    }

    pointerStart = {
      x: event.clientX,
      y: event.clientY
    };
  });

  app.addEventListener("pointermove", (event) => {
    if (!dragRail || dragRail.pointerId !== event.pointerId) {
      return;
    }

    dragRail.element.scrollLeft = dragRail.scrollLeft - (event.clientX - dragRail.startX);
  });

  function releaseDragRail(pointerId) {
    if (!dragRail || dragRail.pointerId !== pointerId) {
      return false;
    }

    dragRail.element.classList.remove("is-dragging");
    dragRail = null;
    return true;
  }

  app.addEventListener("pointerup", (event) => {
    if (releaseDragRail(event.pointerId)) {
      return;
    }

    if (!pointerStart) {
      return;
    }

    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    pointerStart = null;

    if (state.tab === "reels" && Math.abs(deltaY) > 56 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
      shiftReel(deltaY < 0 ? 1 : -1);
      return;
    }

    if (Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      switchTabByOffset(deltaX < 0 ? 1 : -1);
    }
  });

  app.addEventListener("pointercancel", (event) => {
    releaseDragRail(event.pointerId);
    pointerStart = null;
  });

  app.addEventListener("wheel", (event) => {
    if (state.tab !== "reels" || state.dmChatId || state.profileEditorOpen || state.profileSettingsOpen || state.statEditor) {
      return;
    }
    const now = Date.now();
    if (Math.abs(event.deltaY) < 18 || now - lastWheelAt < 480) {
      return;
    }
    lastWheelAt = now;
    shiftReel(event.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      goBack();
    }
  });

  window.addEventListener("focus", () => {
    refreshExternalData(true);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshExternalData(true);
    }
  });

  render();
  refreshExternalData(true);
})();
