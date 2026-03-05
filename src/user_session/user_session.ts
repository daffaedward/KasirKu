import { generate_hex } from "../utils/utils";

export interface user_session_interface {
    user_id: number,
    role_id: number,
    is_active: Boolean
}

export class user_session {
    private timer_id: NodeJS.Timeout;
    private id_length: number = 0;
    private session_ids: Map<string, number> = new Map();
    private timer_wheel: Array<Map<string, user_session_interface>> = [];
    private current_slot: number = 0;
    private max_slots: number = 0;

    constructor(wheel_per_second: number = 1, max_slots: number = 30, id_length: number = 32) {
        this.id_length = id_length % 2 === 0 ? id_length : id_length + 1;
        this.max_slots = max_slots;

        for (let i = 0; i < max_slots; i++) this.timer_wheel.push(new Map());

        this.timer_id = setInterval(() => {
            this.current_slot = (this.current_slot + 1) % this.max_slots;
            const expired_sessions = this.timer_wheel[this.current_slot];
            for (let session_id of expired_sessions) {
                if (session_id[1].is_active === false) {
                    this.session_ids.delete(session_id[0]);
                    expired_sessions.delete(session_id[0]);
                } else session_id[1].is_active = false;
            }
        }, wheel_per_second * 1000);
    }

    add(user_id: number, role_id: number): string | false {
        for (let a = 0; a < 100; a++) { // 100x tries
            const id = generate_hex(this.id_length);

            if (!this.session_ids.has(id)) {
                const current_slot = (this.current_slot + 1) % this.max_slots;

                this.session_ids.set(id, current_slot);
                this.timer_wheel[current_slot].set(id, {user_id, role_id, is_active: true});
                return id;
            }
        }
        
        return false; // try again
    }
    has(session_id: string): Boolean {
        return this.session_ids.has(session_id);
    }
    get(session_id: string): user_session_interface | false {
        const slot = this.session_ids.get(session_id);
        if (slot !== undefined) {
            return this.timer_wheel[slot].get(session_id) ?? false;
        }
        return false;
    }
    change_role(user_id: number, role_id: number): void {
        this.timer_wheel.forEach(slot => {
            for (const [_, data] of slot) {
                if (data.user_id === user_id) data.role_id = role_id;
            }
        })
    }
    remove(session_id: string): void {
        const slot = this.session_ids.get(session_id);
        if (slot !== undefined) {
            this.session_ids.delete(session_id);
            this.timer_wheel[slot].delete(session_id);
        }
    }
    revoke_all_by_userid(user_id: number): void {
        this.timer_wheel.forEach(slot => {
            for (const [session_id, data] of slot) {
                if (data.user_id === user_id) {
                    slot.delete(session_id);
                    this.session_ids.delete(session_id);
                }
            }
        });
    }
    revoke_all_by_roleid(role_id: number): void {
        this.timer_wheel.forEach(slot => {
            for (const [session_id, data] of slot) {
                if (data.role_id === role_id) {
                    slot.delete(session_id);
                    this.session_ids.delete(session_id);
                }
            }
        });
    }

    destroy() {
        clearInterval(this.timer_id);
        this.session_ids.clear();
        for (let slot of this.timer_wheel) slot.clear();
        this.timer_wheel = [];
        this.current_slot = 0;
        this.max_slots = 0;
        this.id_length = 0;
    }
}