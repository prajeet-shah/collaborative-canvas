# 🎨 Collaborative Canvas

A **real-time multi-user drawing application** built using **Vanilla JavaScript**, **Node.js**, **Express**, and **Socket.IO**.  
It allows multiple users to draw simultaneously on a shared canvas with live synchronization, brush tools, and user tracking.

---

## 🚀 Features

- 🖌️ **Drawing Tools** – Brush, Eraser, adjustable colors, and stroke width  
- 🌈 **Brush Styles** – Solid, Dotted, and Dashed brushes  
- ⚡ **Real-time Sync** – Instantly reflect strokes and cursor movements across all connected users  
- 👥 **User Tracking** – Shows the number of users online in real time  
- ↩️ **Undo/Redo** – Revert or restore strokes globally  
- 🧠 **Canvas Replay** – Automatically redraws the existing canvas state for new joiners  
- 📱 **Responsive UI** – Works seamlessly on desktop and mobile browsers

---

## 🧱 Tech Stack

| Layer | Technology |
|--------|-------------|
| **Frontend** | HTML5, Vanilla JavaScript, Canvas API |
| **Backend** | Node.js, Express.js |
| **Real-time Communication** | Socket.IO |
| **Styling** | CSS3 |

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/<your-username>/collaborative-canvas.git
cd collaborative-canvas
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Start the Server
```bash
npm start
```

### 4️⃣ Access the Application
Open your browser and visit:  
👉 `http://localhost:3000`

---

## 🧪 Testing with Multiple Users

You can test collaboration in two ways:

### 🖥️ Multiple Tabs (Same Device)
1. Open `http://localhost:3000` in multiple browser tabs.  
2. Draw in one – changes instantly appear in others.

### 📱 Multiple Devices (Same Wi-Fi)
1. Start the app on your laptop.  
2. Find your local IP address (example: `192.168.1.10`).  
3. Open on your phone’s browser:  
   👉 `http://192.168.1.10:3000`  
4. You can now draw together in real time!

---

## 🐞 Known Limitations

| Area | Description |
|------|--------------|
| 🖱️ Latency | Slight delay on slower or high-latency networks. |
| 🧭 Touch Support | Works for drawing but not optimized for gestures (zoom/pan). |


---

## 📁 Folder Structure

```
collaborative-canvas/
├── client/
│   ├── index.html
│   ├── style.css
│   ├── main.js
│   ├── canvas.js
│   ├── websocket.js
├── server/
│   ├── server.js
│   ├── rooms.js
│   └── drawing-state.js
├── package.json
├── README.md
└── ARCHITECTURE.md
```

---

## 💡 Future Enhancements

- 🧰 Add shape tools (rectangle, circle, line, text)  
- 💾 Save and restore previous sessions  
- 🔒 Add authentication and user profiles  
- 🧮 Add performance metrics (FPS, latency graph)  
- 📱 Enhanced mobile experience with gesture support  

---






