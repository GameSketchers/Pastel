console.log('Worker loading...');
try {
const sockets = new Map();
const playerList = new Map();
const chatMessages = new Map();
const servers={"server07":"c","server06":"Y","server05":"U","server04":"Q","server03":"M","server02":"I","server01":"E"};
const fallback = [6,2,5,4,3,1,7];
class PastelLiveManager {
    constructor(maxMessages = 300) {
        this.players = new Map();
        this.playerFilter = { language: 'all', filterText: [] };
        this.chatFilter = { language: 'all', filterText: [] };
        this.maxMessages = maxMessages;
        this.messages = [];
    }
    setPlayerFilter({ language = 'all', filterText = '' }) {
        this.playerFilter = {
            language: language.toLowerCase(),
            filterText: filterText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        };
    }

    addPlayer(language, roomCode, player) {
        const lang = language.toLowerCase();
        if (!this.players.has(lang)) this.players.set(lang, new Map());
        const rooms = this.players.get(lang);
        let roomWrapperHTML = null;
        if (!rooms.has(roomCode)) {
            rooms.set(roomCode, new Map());
            roomWrapperHTML = `<div class="room-wrapper" data-room="${roomCode}" style="display:contents"></div>`;
        }
        const room = rooms.get(roomCode);
        room.set(player.id, player);

        if (this.isPlayerFiltered(player, lang, roomCode)) {
            self.postMessage({type:'player:addPlayer',details:{selector:`.room-wrapper[data-room="${roomCode}"]`,wrapper:roomWrapperHTML,html:this.renderPlayerHTML(player,roomCode)}});
        }
    }

    removePlayer(language, roomCode, playerId) {
        const lang = language.toLowerCase();
        const rooms = this.players.get(lang);
        if (!rooms) return null;
        const room = rooms.get(roomCode);
        if (!room) return null;
        const player = room.get(playerId);
        if (!player) return null;
        room.delete(playerId);
        if(this.isPlayerFiltered(player, lang, roomCode)){
            self.postMessage({type:'player:deletePlayer',details:{selector:`.player-card[data-name="${player.nick}"][data-room="\${roomCode}"]`}});
        }
    }

    isPlayerFiltered(player, lang, roomCode) {
        if (this.playerFilter.language !== 'all' && this.playerFilter.language !== lang) return false;
        if (!this.playerFilter.filterText.length) return true;
        const nameLower = player.name.toLowerCase();
        const roomLower = roomCode.toLowerCase();
        return this.playerFilter.filterText.some(ft => nameLower.includes(ft) || roomLower.includes(ft));
    }

    getPlayer(language, roomCode, playerId){return this.players.get(language.toLowerCase())?.get(roomCode)?.get(playerId)}
    getFilteredPlayers() {const result=[];for(const [lang, rooms] of this.players){if(this.playerFilter.language!=='all'&&this.playerFilter.language !== lang) continue;for(const [roomCode, room] of rooms){const playersInRoom=[];for(const player of room.values()){if (this.isPlayerFiltered(player, lang, roomCode)) playersInRoom.push(player)}if(playersInRoom.length) result.push({roomCode,players:playersInRoom})}}return result}
    getFilteredPlayersHTML(){self.postMessage({type:'chat:renderMessages',details:{html:this.getFilteredPlayers().map(room=>{const playersHTML=room.players.map(p=>this.renderPlayerHTML(p,room.roomCode)).join('\n');return `<div class="room-wrapper" data-room="${room.roomCode}" style="display:contents">${playersHTML}</div>`}).join('\n')}})}
    renderPlayerHTML(p,r){return `<div class="player-card"><div class="avatar-badge"><img src="${p.foto}" class="player-avatar">${p.vitorias?'<div class="player-win"><span>'+p.vitorias+'</span></div>':''}</div><div class="player-info"><h3 class="player-name">${p.nick}</h3><span class="room-code">${r}</span></div></div>`}
    setChatFilter({ language = 'all', filterText = '' }) {
        this.chatFilter = {
            language: language.toLowerCase(),
            filterText: filterText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        };
    }
    isMessageFiltered(data) {
       const lang = data.language?.toLowerCase()||'all';
       if (this.playerFilter.language!=='all'&&this.playerFilter.language!==lang) return false;
       if (!this.chatFilter.filterText.length) return true;
       const txt = ((data.user || '') + ' ' + (data.text || '')).toLowerCase();
       return this.chatFilter.filterText.some(ft => txt.includes(ft));
    }
    renderMessageHTML(data) {
       if(data.type === 'system'){return `<div class="system-message system-${data.style}">${data.text}</div>`}
       else{return `<div class="message"><div class="avatar-badge"><img src="${data.avatar}" class="message-avatar">${data.win?'<div class="player-win"><span>'+data.win+'</span></div>':''}</div><div class="message-content"><p class="message-user">${data.user}</p><p class="message-text">${data.text}</p></div></div>`}
    }
    addMessage(data){
       this.messages.push(data);
       if (this.messages.length>this.maxMessages) this.messages.shift();
       if (this.isMessageFiltered(data)){self.postMessage({type:'chat:addMessage',details:{html:this.renderMessageHTML(data)}})}
    }

    getFilteredMessages(){return this.messages.filter(m=>this.isMessageFiltered(m))}
    getFilteredMessagesHTML(){self.postMessage({type:'chat:renderMessages',details:{html:this.getFilteredMessages().map(msg=>this.renderMessageHTML(msg)).join('\n')}})}
    escapeHTML(str){return str.replace(/[&<>"']/g,tag=>({'&':'&amp;','<': '&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[tag]))}
}

class pastelLiveSockett{
  constructor() {
    this.manager = new PastelLiveManager();
    this.sockets = new Set();
    this.pingInterval = null;
    this.actions = {
            "5": (ws, data) => {
              for(let i=0;i<data[5].length;i++){
              data[5][i].foto ||= `https://gartic.io/static/images/avatar/svg/${data[1].avatar}.svg`;
              this.manager.addPlayer(ws.language,ws.roomCode,data[5][i]);
              }
              this.manager.addMessage({type:"system",language:ws.language,style:"success",text:`${ws.roomCode} ~ Pastel Active!`});
            },
            "23": (ws,data) => {
            data[1].foto ||= `https://gartic.io/static/images/avatar/svg/${data[1].avatar}.svg`;
            this.manager.addPlayer(ws.language,ws.roomCode,data[1]);
            this.manager.addMessage({type:"system",language:ws.language,style:"info",text:`${ws.roomCode} ~ ${data[1].nick} Joined!`});
            },
            "24": (ws, data) => {
             const player=this.manager.getPlayer(ws.language,ws.roomCode,data[1]);
             this.manager.removePlayer(ws.language,ws.roomCode,data[1]);
             this.manager.addMessage({type:"system",language:ws.language,style:"info",text:`${ws.roomCode} ~ ${player.nick} Leave.`})
           },

            "11": (ws,data) => {
            const player=this.manager.getPlayer(ws.language,ws.roomCode,data[1]);
            this.manager.addMessage({type:'user',language:ws.language,user:`${ws.roomCode} ~ ${player.nick}`,avatar:player.foto,text:this.manager.escapeHTML(data[2]),win:player.vitorias||null})
            },
            "45": (ws,data) => {
            const player1 = this.manager.getPlayer(ws.language,ws.roomCode,data[1])
            const player2 = this.manager.getPlayer(ws.language,ws.roomCode,data[2])
            this.manager.addMessage({type:"system",language:ws.language,style:"error",text:`${ws.roomCode} ~ ${player1.nick} voted to kick out ${player2.nick}.`})
            },
            "6": (ws,data) => {data[1]===6&&(this.removeSocket(ws)|fallback[ws.fallbackIndex+1]!==undefined&&(this.createSocket(ws.ip,ws.language,ws.roomCode,null,ws.fallbackIndex+1)))}
        };
  }

  createSocket(ip, language, roomCode, serverText = null, index = 0) {
    const scode = servers[serverText?new URL(serverText).hostname.split(".")[0]:`server0${fallback[index]}`];
    const roomId = roomCode.substring(2);
    const ws = new WebSocket(`wss://${ip}/__cpw.php?u=d3NzOi8vc2VydmVyMD${scode}uZ2FydGljLmlvL3NvY2tldC5pby8/RUlPPTMmdHJhbnNwb3J0PXdlYnNvY2tldA==&o=aHR0cHM6Ly9nYXJ0aWMuaW8=`);
    ws.ip=ip;
    ws.language=language;
    ws.roomCode=roomCode;
    ws.fallbackIndex=index;
    ws.onopen = () => {
      ws.send(`42[12,{"v":20000,"sala":"${roomId}"}]`);
      ws.send(`42[46,0]`);
    };
    ws.onmessage = e => {
     const d = e.data;
     if (d[0] === '4' && d[1] === '2' && d[4] === '0') return;
     this.handleMessage(ws, JSON.parse(d.substring(2)));
   };
    ws.onerror = ws.onclose = () => {this.removeSocket(ws)};
    this.sockets.add(ws);
    if (!this.pingInterval) this.startPing();
  }

  removeSocket(ws) {
    if(this.sockets.delete(ws)){ws.close()}
    if(this.sockets.size===0){this.stopPing()}
  }

  startPing() {
    this.pingInterval = setInterval(() => {
      for (const ws of this.sockets) {
        if(ws.readyState===WebSocket.OPEN){ws.send("2")}
        else{this.removeSocket(ws)}
      }
    }, 7777);
  }

  stopPing() {
    clearInterval(this.pingInterval);
    this.pingInterval = null;
  }

  handleMessage(ws,data){this.actions[data[0]]?.(ws,data)}
}

const pastelLiveSocket = new pastelLiveSockett();
self.onmessage = ({ data }) => {
  const { type, details } = data;
  switch(type) {
    case 'search':
        if (details.task === 'player') {
            pastelLiveSocket.manager.setPlayerFilter({language:details.filterLanguage,filterText:details.filterText});
            pastelLiveSocket.manager.getFilteredPlayersHTML();
        }
        if (details.task === 'chat') {
            pastelLiveSocket.manager.setChatFilter({language:details.filterLanguage,filterText:details.filterText});
            pastelLiveSocket.manager.getFilteredMessagesHTML();
        }
    break;
    case 'create:socket':
          if (details.task === "live") pastelLiveSocket.createSocket(details.ip,details.language,details.roomCode,details.server,details.success)
    break;
    default:
    console.log('undefined type:', type, details);
   }
};
} catch (error) {
    self.postMessage({
        type: 'error',
        details: { message: error.message, stack: error.stack }
    });

}

