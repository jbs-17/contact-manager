export function oneTimePageFactory(app,method, prefix, {redirect} = {}) {
    const db = new Map();
    app[method](`${prefix}/:uuid`, (req, res, next) => {
        const { uuid } = req.params;
        if (!db.has(uuid)) {
          if(redirect){
            return res.redirect(redirect);
          }
            return next();
        }
        db.get(uuid)(req, res, next);
        db.delete(uuid);
        return;
    });
    return function (uuid, handler) {
        db.set(uuid, handler);
        return `${prefix}/${uuid}`
    };
}
