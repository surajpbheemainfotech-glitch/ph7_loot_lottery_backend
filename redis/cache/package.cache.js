export const PACKAGE_LIST_KEY = "packages:all:v1";
export const PACKAGE_TTL_SECONDS = 86400;

export  function addPackageFeilds(rows){

    const nowMs = Date.now()

    return rows.map((r) => {
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