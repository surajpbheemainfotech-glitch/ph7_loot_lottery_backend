export const DUMMY_USER_LIST_KEY = "dummy-users:all:v1";
export const DUMMY_USER_TTL_SECONDS = 86400;

export  function addDummyUserFeilds(users){

    const nowMs = Date.now()

    return users.map((r) => {
        const startAtMs = new Date(r.start_at).getTime();
        const expireAtMs = new Date(r.expire_at).getTime();

        let status = "expired"

        if(nowMs < startAtMs){
            status = "upcoming"
        }else{
            if(nowMs >= startAtMs && nowMs < expireAtMs){
                status = "active"
            }
        }

        return {
            ...r,
            status,
            startAtMs,
            expireAtMs,
            serverNowms: nowMs
        }
    })
}