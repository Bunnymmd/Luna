(() => {
  const app = document.getElementById("contact-app");
  const dbName = "LunaDesktopDB";
  const storeName = "store";

  const inlineSvg = (label, from, to, ink = "#ffffff") => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient><radialGradient id="r" cx="72%" cy="24%" r="65%"><stop offset="0%" stop-color="#ffffff" stop-opacity=".42"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="512" height="512" fill="url(#g)"/><circle cx="380" cy="130" r="220" fill="url(#r)"/><circle cx="116" cy="396" r="150" fill="#000000" opacity=".10"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${ink}" font-family="Georgia,serif" font-size="132" font-weight="700" letter-spacing="8">${label}</text></svg>`)}`;

  const defaultContactImages = [
    inlineSvg("CHAR", "#ffeaf4", "#d8b5cf", "#86667a"),
    inlineSvg("NPC", "#ecf9fb", "#b7d7e6", "#657785"),
    inlineSvg("USER", "#f4ecff", "#cabbea", "#756a8f"),
    inlineSvg("REL", "#fff0e7", "#e4b5a8", "#856d64")
  ];
  const contactTypes = [
    { title: "CHAR", copy: "你的那个‘TA’" },
    { title: "NPC", copy: "隐藏可攻略" },
    { title: "USER", copy: "快速切换身份" },
    { title: "RELATIONSHIP", copy: "建立与维护" }
  ];
  const contactTypeIndex = { CHAR: 0, NPC: 1, USER: 2 };
  const genderOptions = ["女", "男", "无性别", "保密", "其他"];

  let contacts = [];
  let contactImages = [...defaultContactImages];
  let contactView = "home";
  let contactSelectedType = "CHAR";
  let contactEditing = null;
  let contactIdSerial = Date.now();

  const fallbackGet = (key) => {
    const value = localStorage.getItem(`luna_${key}`);
    return value ? JSON.parse(value) : void 0;
  };

  const fallbackSet = (key, value) => {
    localStorage.setItem(`luna_${key}`, JSON.stringify(value));
  };

  const openDb = () => new Promise((resolve, reject) => {
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

  const getItem = async (key) => {
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
  };

  const setItem = async (key, value) => {
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
  };

  const createElement = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  };

  const clearApp = () => {
    app.replaceChildren();
  };

  const closeContactApp = () => {
    window.parent?.postMessage({ app: "contact", type: "close" }, "*");
  };

  const setTitle = (text, onClick) => {
    const title = createElement("h1", "contact-title", text);
    title.addEventListener("click", onClick);
    app.appendChild(title);
  };

  const getContactDefaultImage = (type) => {
    const index = contactTypeIndex[type] ?? 0;
    return contactImages[index] || defaultContactImages[index] || defaultContactImages[0];
  };

  const createContactId = (type) => {
    const usedIds = new Set(contacts.map((item) => item.id));
    let serial = Math.max(contactIdSerial + 1, Date.now());
    let id = `${type}-${serial.toString(36).toUpperCase().padStart(8, "0")}`;
    while (usedIds.has(id)) {
      serial += 1;
      id = `${type}-${serial.toString(36).toUpperCase().padStart(8, "0")}`;
    }
    contactIdSerial = serial;
    setItem("contactIdSerial", contactIdSerial);
    return id;
  };

  const createContactDraft = (type) => ({
    id: createContactId(type),
    type,
    avatar: getContactDefaultImage(type),
    nickname: "",
    name: "",
    gender: "",
    signature: "",
    content: "",
    wechatAutoFriendRequest: false,
    wechatLinkedUserId: ""
  });

  const normalizeContact = (contact) => ({
    id: contact.id,
    type: contact.type,
    avatar: contact.avatar || getContactDefaultImage(contact.type),
    nickname: contact.nickname || "",
    name: contact.name || "",
    gender: contact.gender || "",
    signature: contact.signature || "",
    content: contact.content || "",
    wechatAutoFriendRequest: contact.type === "USER" ? false : Boolean(contact.wechatAutoFriendRequest),
    wechatLinkedUserId: contact.type === "USER" ? "" : contact.wechatLinkedUserId || ""
  });

  const formatContactValue = (value, fallback = "未填写") => {
    const normalized = typeof value === "string" ? value.trim() : value;
    return normalized || fallback;
  };

  const getContactDisplayName = (contact, fallback = "未命名") => (
    formatContactValue(contact.nickname || contact.name, fallback)
  );

  const getAvailableUserContacts = () => (
    contacts.filter((item) => item.type === "USER" && item.id !== contactEditing?.id)
  );

  const renderContactLine = (label, value, className = "") => {
    const lineClass = `contact-card__line${className ? ` ${className}` : ""}`;
    return createElement("div", lineClass, `${label}：${formatContactValue(value)}`);
  };

  const chooseAvatar = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        contactEditing.avatar = reader.result;
        renderEdit();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const chooseContactImage = (index) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = async () => {
        const image = reader.result;
        contactImages[index] = image;
        await setItem(`contact_image_${index}`, image);
        renderHome();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const renderContactCard = (contact, options = {}) => {
    const card = createElement("div", `contact-card${options.onClick ? " contact-card--clickable" : ""}`);
    if (options.onClick) card.addEventListener("click", options.onClick);

    const body = createElement("div", "contact-card__body");
    const photoTag = options.editableAvatar ? "button" : "div";
    const photo = createElement(photoTag, `contact-card__photo${options.editableAvatar ? " contact-card__photo--button" : ""}`);
    if (options.editableAvatar) {
      photo.type = "button";
      photo.addEventListener("click", (event) => {
        event.stopPropagation();
        chooseAvatar();
      });
    }

    const img = document.createElement("img");
    img.src = contact.avatar || getContactDefaultImage(contact.type);
    img.alt = "联系人证件照";
    photo.appendChild(img);

    const info = createElement("div", "contact-card__info");
    const top = createElement("div", "contact-card__top");
    top.appendChild(createElement("div", "contact-card__nickname", `昵称：${formatContactValue(contact.nickname)}`));
    info.appendChild(top);
    info.appendChild(renderContactLine("姓名", contact.name, "contact-card__line--name"));
    info.appendChild(renderContactLine("性别", contact.gender));
    info.appendChild(renderContactLine("ID", contact.id, "contact-card__line--id"));
    info.appendChild(renderContactLine("个性签名", contact.signature));

    body.append(photo, info);
    card.appendChild(body);
    return card;
  };

  const renderHome = () => {
    clearApp();
    contactView = "home";
    setTitle("CONTACT", closeContactApp);
    const stack = createElement("div", "contact-stack");
    contactTypes.forEach((item, index) => {
      const row = createElement("div", `contact-category${item.title in contactTypeIndex ? " contact-category--active" : ""}`);
      if (item.title in contactTypeIndex) {
        row.addEventListener("click", () => {
          contactSelectedType = item.title;
          renderList();
        });
      }
      const media = createElement("button", "contact-category__media");
      media.type = "button";
      media.setAttribute("aria-label", `添加${item.title}图片`);
      media.addEventListener("click", (event) => {
        event.stopPropagation();
        chooseContactImage(index);
      });
      const img = document.createElement("img");
      img.src = contactImages[index] || defaultContactImages[index];
      img.alt = item.title;
      media.appendChild(img);

      const body = createElement("div", "contact-category__body");
      body.appendChild(createElement("h2", "contact-category__title", item.title));
      body.appendChild(createElement("p", "contact-category__copy", item.copy));
      row.append(media, body);
      stack.appendChild(row);
    });
    app.appendChild(stack);
  };

  const renderPlusButton = () => {
    const button = createElement("button", "contact-plus");
    button.type = "button";
    button.setAttribute("aria-label", "添加联系人");
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
    button.addEventListener("click", () => {
      contactEditing = createContactDraft(contactSelectedType);
      renderEdit();
    });
    app.appendChild(button);
  };

  const renderList = () => {
    clearApp();
    contactView = "list";
    setTitle(contactSelectedType, renderHome);
    const stack = createElement("div", "contact-stack contact-stack--tight");
    const currentContacts = contacts.filter((item) => item.type === contactSelectedType);
    if (currentContacts.length === 0) {
      stack.appendChild(createElement("div", "contact-empty", "暂无联系人"));
    } else {
      currentContacts.forEach((contact) => {
        stack.appendChild(renderContactCard(contact, {
          onClick: () => {
            contactEditing = normalizeContact(contact);
            contactSelectedType = contact.type;
            renderEdit();
          }
        }));
      });
    }
    app.appendChild(stack);
    renderPlusButton();
  };

  const renderField = (label, field, options = {}) => {
    const wrap = createElement("div", "contact-field");
    const labelNode = createElement("label", "", label);
    labelNode.setAttribute("for", `contact-${field}`);
    const input = document.createElement(options.multiline ? "textarea" : "input");
    input.id = `contact-${field}`;
    input.value = contactEditing[field] || "";
    if (options.list) input.setAttribute("list", options.list);
    input.addEventListener("input", () => {
      contactEditing[field] = input.value;
      refreshCardPreview();
    });
    wrap.append(labelNode, input);
    return wrap;
  };

  const refreshCardPreview = () => {
    const holder = document.getElementById("contact-card-preview");
    if (!holder || !contactEditing) return;
    holder.replaceChildren(renderContactCard(contactEditing, { editableAvatar: true }));
  };

  const renderWechatFriendSettings = () => {
    const userContacts = getAvailableUserContacts();
    const hasSelectedUser = userContacts.some((item) => item.id === contactEditing.wechatLinkedUserId);
    if (!hasSelectedUser) {
      contactEditing.wechatLinkedUserId = userContacts[0]?.id || "";
    }
    if (contactEditing.wechatAutoFriendRequest && userContacts.length === 0) {
      contactEditing.wechatAutoFriendRequest = false;
    }

    const panel = createElement("div", "contact-wechat");
    const toggle = createElement("button", `contact-wechat__toggle${contactEditing.wechatAutoFriendRequest ? " contact-wechat__toggle--on" : ""}`);
    toggle.type = "button";
    toggle.disabled = userContacts.length === 0;
    toggle.setAttribute("aria-pressed", contactEditing.wechatAutoFriendRequest ? "true" : "false");
    toggle.addEventListener("click", () => {
      if (userContacts.length === 0) return;
      contactEditing.wechatAutoFriendRequest = !contactEditing.wechatAutoFriendRequest;
      if (!contactEditing.wechatLinkedUserId) {
        contactEditing.wechatLinkedUserId = userContacts[0]?.id || "";
      }
      renderEdit();
    });

    const copy = createElement("div", "contact-wechat__copy");
    copy.appendChild(createElement("span", "contact-wechat__eyebrow", "WECHAT"));
    copy.appendChild(createElement("strong", "", "保存后主动发送好友申请"));
    copy.appendChild(createElement("small", "", userContacts.length === 0 ? "先添加一个 USER 身份，再让联系人发起申请。" : "申请会以当前联系人口吻发给下方 USER 身份。"));

    const switchNode = createElement("span", "contact-wechat__switch");
    switchNode.appendChild(createElement("span", "contact-wechat__knob"));
    toggle.append(copy, switchNode);
    panel.appendChild(toggle);

    const userSection = createElement("div", "contact-user-link");
    userSection.appendChild(createElement("div", "contact-user-link__title", "关联 USER 身份"));
    if (userContacts.length === 0) {
      userSection.appendChild(createElement("div", "contact-user-link__empty", "暂无可关联 USER"));
    } else {
      const grid = createElement("div", "contact-user-link__grid");
      userContacts.forEach((user) => {
        const option = createElement("button", `contact-user-link__item${user.id === contactEditing.wechatLinkedUserId ? " contact-user-link__item--active" : ""}`);
        option.type = "button";
        option.addEventListener("click", () => {
          contactEditing.wechatLinkedUserId = user.id;
          renderEdit();
        });
        const avatar = document.createElement("img");
        avatar.src = user.avatar || getContactDefaultImage("USER");
        avatar.alt = getContactDisplayName(user, "USER");
        const body = createElement("span", "contact-user-link__body");
        body.appendChild(createElement("strong", "", getContactDisplayName(user, "USER")));
        body.appendChild(createElement("small", "", user.signature || user.id));
        option.append(avatar, body);
        grid.appendChild(option);
      });
      userSection.appendChild(grid);
    }
    panel.appendChild(userSection);
    return panel;
  };

  const postWechatFriendRequest = (contact) => {
    const user = contacts.find((item) => item.type === "USER" && item.id === contact.wechatLinkedUserId && item.id !== contact.id);
    if (!contact.wechatAutoFriendRequest || !user) return;
    window.parent?.postMessage({
      app: "contact",
      type: "wechat-friend-request",
      requestId: `wechat-friend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fromContact: contact,
      toUser: user
    }, "*");
  };

  const saveContact = async () => {
    const nextContact = normalizeContact(contactEditing);
    const hasExisting = contacts.some((item) => item.id === nextContact.id);
    contacts = hasExisting ? contacts.map((item) => item.id === nextContact.id ? nextContact : item) : [...contacts, nextContact];
    await setItem("contacts", contacts);
    postWechatFriendRequest(nextContact);
    contactSelectedType = nextContact.type;
    contactEditing = null;
    renderList();
  };

  const deleteContact = async () => {
    const nextType = contactEditing.type;
    contacts = contacts.filter((item) => item.id !== contactEditing.id);
    await setItem("contacts", contacts);
    contactSelectedType = nextType;
    contactEditing = null;
    renderList();
  };

  const renderEdit = () => {
    clearApp();
    contactView = "edit";
    const isExisting = contacts.some((item) => item.id === contactEditing.id);
    setTitle(`${isExisting ? "编辑" : "添加"} ${contactEditing.type}`, () => {
      contactSelectedType = contactEditing.type;
      contactEditing = null;
      renderList();
    });

    const form = createElement("div", "contact-form");
    const preview = createElement("div", "");
    preview.id = "contact-card-preview";
    preview.appendChild(renderContactCard(contactEditing, { editableAvatar: true }));
    form.appendChild(preview);
    form.appendChild(renderField("昵称", "nickname"));
    form.appendChild(renderField("姓名", "name"));
    form.appendChild(renderField("性别", "gender", { list: "contact-gender-options" }));
    form.appendChild(renderField("个性签名", "signature"));
    form.appendChild(renderField("设定内容", "content", { multiline: true }));
    if (contactEditing.type !== "USER") {
      form.appendChild(renderWechatFriendSettings());
    }

    const datalist = document.createElement("datalist");
    datalist.id = "contact-gender-options";
    genderOptions.forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      datalist.appendChild(option);
    });
    form.appendChild(datalist);

    const actions = createElement("div", "contact-actions");
    if (isExisting) {
      const deleteButton = createElement("button", "contact-action contact-action--delete", "删除");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", deleteContact);
      actions.appendChild(deleteButton);
    }
    const saveButton = createElement("button", `contact-action contact-action--save${isExisting ? "" : " contact-action--solo"}`, "保存");
    saveButton.type = "button";
    saveButton.addEventListener("click", saveContact);
    actions.appendChild(saveButton);
    form.appendChild(actions);
    app.appendChild(form);
  };

  const init = async () => {
    const storedContacts = await getItem("contacts");
    if (Array.isArray(storedContacts)) contacts = storedContacts.map(normalizeContact);
    const storedSerial = await getItem("contactIdSerial");
    if (typeof storedSerial === "number") contactIdSerial = Math.max(contactIdSerial, storedSerial);
    const storedImages = await Promise.all([
      getItem("contact_image_0"),
      getItem("contact_image_1"),
      getItem("contact_image_2"),
      getItem("contact_image_3")
    ]);
    contactImages = storedImages.map((item, index) => item || defaultContactImages[index]);
    renderHome();
  };

  init();
})();
