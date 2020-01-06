import "webrtc-adapter";

import socketIOClient from "socket.io-client";
// @ts-ignore
import Peer from "peerjs";

async function main() {
  try {
    const io = socketIOClient();
    const peer = new Peer();

    const $count = document.querySelector("#onlineCount");
    const $list = document.querySelector("#onlineList");
    const $myId = document.querySelector("#myId");
    const $roomNumberInput = document.querySelector<HTMLInputElement>(
      "#roomNumberInput"
    );
    const $callButton = document.querySelector("#callButton");
    const $leaveButton = document.querySelector("#leaveButton");
    const $video = document.querySelector<HTMLVideoElement>("#myVideo");
    const $otherVideosContainer = document.querySelector(
      "#otherVideosContainer"
    );

    const $chatContainer = document.querySelector("#chatContainer");
    const $chatInput = document.querySelector("#chatInput");
    const $fileContainer = document.querySelector("#fileContainer");
    const $fileInput = document.querySelector("#fileInput");

    const clientInfo = {
      id: "",
      roomNumber: "test",
      isIn: false // 是否已进入了会议
    };
    let mediaStream: MediaStream;
    const connections = [];

    // 更新dom的人数显示
    io.on("clientCountChange", (ids: string[]) => {
      $count.textContent = ids.length + "";
      $list.innerHTML = ids
        .filter(id => id !== clientInfo.id)
        .map(id => `<li id='u${id}'>${id}</li>`)
        .join("");
    });
    // 更新dom的其他用户的会议状态
    io.on("inRoomClientCountChange", async (inRoomIds: string[]) => {
      $list.querySelectorAll("li").forEach($li => {
        const id = $li.getAttribute("id").slice(1);
        if (inRoomIds.includes(id)) {
          if (!$li.getAttribute(`data-isIn`)) {
            $li.textContent += `(会议中)`;
            $li.setAttribute("data-isIn", "yes");
          }
        } else {
          $li.textContent = $li.textContent.split("(")[0];
          $li.removeAttribute("data-isIn");
        }
      });
    });

    // 新加入会议的client向其他已在room的client发起连接建立
    io.on("connectToOtherClients", async otherInRoomIds => {
      if (!mediaStream) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          // audio: true // TODO: 暂未处理同时音频视频的情况，这回连续触发两次 stream 事件
       }).catch(err => {
          alert(err);
          throw err;
        });
        $video.srcObject = stream;
        mediaStream = stream;
      }
      otherInRoomIds.map(id => {
        const $v = createAndInsertVideoElement($otherVideosContainer, id);
        const localCall = peer.call(id, mediaStream);
        const localConn = peer.connect(id);
        connections.push(localConn);
        localCall.on("stream", stream => {
          $v.srcObject = stream;
        });
        localConn.on('data', onReceivedData.bind(null, $fileContainer))
      });
    });
    // 监听到有其他会议室用户退出时
    io.on('clientDisconnected', anotherClientId => {
      if (clientInfo.isIn)
        document.querySelector(`#v${anotherClientId}`).remove();
    })
    io.on('textMessage', ({id, text}) => {
      $chatContainer.innerHTML+=`<div>[${ id===clientInfo.id ? '我': id}] ${text}</div>`
    });
    window.addEventListener("beforeunload", () => {
      io.emit("clientLeave", clientInfo.isIn);
    });

    peer.on("open", id => {
      io.emit("clientJoin", id);
      $myId.textContent = id;
      clientInfo.id = id;
    });
    peer.on('connection', function( dataConnection) {
      connections.push(dataConnection);
      dataConnection.on('data', onReceivedData.bind(null, $fileContainer))
    });
    peer.on("call", call => {
      const remoteId = call.peer;
      call.answer(mediaStream);
      // console.log(call);
      call.on("stream", stream => {
        const $v = createAndInsertVideoElement($otherVideosContainer, remoteId);
        $v.srcObject = stream;
      });
    });
    peer.on("error", err => {
      alert(`peer error: ${err}`);
    });




    $roomNumberInput.addEventListener("input", ev => {
      clientInfo.roomNumber = (ev.target as HTMLInputElement).value;
    });
    $callButton.addEventListener("click", async () => {
      if (clientInfo.isIn) {
        alert("你已在会议中");
        return;
      }
      if (clientInfo.roomNumber !== "test") alert("请输入房间名称test");

      clientInfo.isIn = true;
      io.emit("clientJoinRoom", clientInfo.id);
    });
    $leaveButton.addEventListener("click", () => {
      if (!clientInfo.isIn) {
        alert("你还未加入会议");
        return;
      }
      clientInfo.isIn = false;
      mediaStream.getTracks().map(t => t.stop());
      $video.srcObject = null;
      mediaStream = null;
      $otherVideosContainer.innerHTML = '';
      io.emit("inRoomClientLeave");
    });

    $chatInput.addEventListener('keyup', (ev: KeyboardEvent) => {
      console.log(connections);
      const target  = ev.target as HTMLInputElement;
      if (ev.key === 'Enter') {
        if (target.value === '') {
          alert('请输入聊天内容')
          return;
        }
        io.emit('textMessage', target.value);
        target.value = '';
      }
    })
    $fileInput.addEventListener('input', async (ev) => {
      const target = ev.target as HTMLInputElement
      if(target.files.length>0) {
        if (connections.length>0) {
          const f : File= target.files[0];
          const blob = new Blob([f], {type: f.type})
          connections.map(c => {
            c.send({
              blob,
              name: f.name,
              type: f.type
            });
          })
        }
      }
    })

  } catch (e) {
    console.log(e);
  }

  function onReceivedData($container, data) {
    const url = URL.createObjectURL(new Blob([data.blob], {
      type: data.type
    }))
    createAndInsertLinkElement($container, url, data.name);
  }
}



function createAndInsertVideoElement($container, id: string) {
  const $v = document.createElement("video");
  $v.setAttribute("id", `v${id}`);
  $v.setAttribute("autoplay", "autoplay");
  $container.insertAdjacentElement("beforeend", $v);
  return $v;
}
function createAndInsertLinkElement($container, url, name) {
  $container.insertAdjacentHTML('beforeend', `<a href="${url}" download="${name}">[${new Date()}] ${name}</a>`);
}

main();
