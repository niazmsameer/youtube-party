import { RoomState, WsApi } from "common";
import { youTubePlayer } from "./player";

class WsClient {
    private ws: WebSocket | undefined;

    private state: RoomState = {
        videoId: "",
        isPlaying: false,
        playbackProgress: 0,
    };

    private roomId: string | undefined;

    private hasHandshaken = false;
    private isConnected = false;

    private baseUrl = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8080";

    private onConnectCallback: (() => void) | undefined;

    private onCloseCallback: (() => void) | undefined;

    public connect(roomId: string, onConnect: () => void, onClose: () => void): void {
        this.roomId = roomId;
        this.onConnectCallback = onConnect;
        this.onCloseCallback = onClose;

        this.ws = new WebSocket(this.baseUrl);

        this.ws.addEventListener("open", () => {
            this.onWsOpen();
        });

        this.ws.addEventListener("message", event => {
            this.onWsMessage(event);
        });

        this.ws.addEventListener("close", event => {
            console.log(event);
            this.onWsClose();
        });
    }

    public getState(): RoomState {
        return this.state;
    }

    private onServerRequestUpdate(): void {
        this.state.playbackProgress = youTubePlayer.getCurrentTime();
        const stateRequestReply: WsApi.StateUpdatePacket = {
            state: this.state,
            updateRequest: false,
        };
        this.ws?.send(JSON.stringify(stateRequestReply));
    }

    private onWsOpen(): void {
        if (!this.roomId) {
            this.ws?.close();
            return;
        }

        // Authenticate
        const auth: WsApi.AuthPacket = {
            username: "user",
            roomId: this.roomId,
        };

        this.ws?.send(JSON.stringify(auth));
    }

    private onWsMessage(event: MessageEvent): void {
        if (!this.isConnected && !this.hasHandshaken) {
            const handshake: WsApi.HandshakePacket = JSON.parse(event.data);

            if (!handshake.auth) {
                this.ws?.close();
                return;
            }

            this.hasHandshaken = true;
            return;
        }

        const stateUpdate: WsApi.StateUpdatePacket = JSON.parse(event.data);

        if (stateUpdate.updateRequest) {
            this.onServerRequestUpdate();
            return;
        }

        if (stateUpdate.state) {
            this.state = stateUpdate.state;
        }

        if (!this.isConnected) {
            this.isConnected = true;
            if (this.onConnectCallback) {
                this.onConnectCallback();
            }
        }
    }

    private onWsClose(): void {
        this.isConnected = false;
        if (this.onCloseCallback) this.onCloseCallback();
    }
}

export const wsClient = new WsClient();
