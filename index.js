const mongo = require("mongodb");
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");

const url = "mongodb://localhost:27017";
const client = new mongo.MongoClient(url);
const db = client.db("foodapp");

function cookie_session(req) {
    const _cookies_obj = {};

    if (req.headers.cookie !== undefined) {
        const _cookies = req.headers.cookie.split(";")
        _cookies.forEach((el) => {
            const parts = el.split("=");
            _cookies_obj[parts[0]] = parts[1];
        });
    }

    req.userdata = {
        session: _cookies_obj
    };
}

function is_cookie_session_invalid(req) {
    return req.userdata === undefined ||
        req.userdata.session === undefined ||
        req.userdata.session.FSID === undefined;
}

function db_session_validate(req, res, callback) {
    const filterObj = { id: req.userdata.session.FSID };
    db.collection("session").findOne(filterObj).then((result) => {
        callback(result);

        db.collection("session").updateOne(filterObj, {
            $set: {
                access_time: Date.now()
            },
            $inc: {
                access_count: 1
            }
        }).then((_) => { });
    });
}

function session_init(req, res, next) {
    cookie_session(req);
    next();
}

function session_validate(req, res, callback) {
    if (is_cookie_session_invalid(req)) {
        callback(false);
    } else {
        // validate the session id
        db_session_validate(req, res, (session_obj) => {
            if (session_obj == null) {
                // db session id does not exist
                res.cookie("FSID", "", { maxAge: 0 });
                callback(false);
                return;
            }

            delete session_obj._id;
            req.userdata.session.data = session_obj;

            log.debug("Session Re-Activate: " + session_obj.id);

            callback(true);
        });
    }
}

function session_process(req, res, callback) {
    session_validate(req, res, (is_valid) => {
        if (!is_valid) {
            res.send({ status: "error", message: "session invalid" });
            return;
        }

        callback();
    });
}

const app = express();
app.disable("x-powered-by");
app.disable("etag");
app.use(express.json());
app.use(express.static("public", { etag: false }));
app.use(session_init);

const kSuccess = "success";

const log = {
    debug: function (message) {
        console.log("[" + Date.now() + "][DEBUG] " + message);
    },
    info: function (message) {
        console.log("[" + Date.now() + "][INFO ] " + message);
    }
}

function md5(value) {
    return crypto.createHash("md5").update(value).digest("hex");
}

client.connect().then(function (value) {
    log.debug("MongoDB connected successfully.");
});

app.get("/test", function (req, res) {
    res.send("Food Ordering App");
});

app.get("/catalog/items", (req, res) => {
    db.collection("catalog").find({}).toArray().then((_result) => {
        _result.forEach((product) => {
            delete product._id;
        });

        res.send({
            status: "success",
            data: _result
        });
    })
});

app.get("/cart/add/:id", function (req, res) {
    log.debug("API CALLED: /cart/add/" + req.params.id);

    session_process(req, res, () => {
        // validation
        if (req.userdata.session.data.user_id == undefined || req.userdata.session.data.user_id == null) {
            res.send({ status: "error", message: "invalid login session" });
        }
        else {
            const _id = parseInt(req.params.id);
            const user_id = req.userdata.session.data.user_id;

            db.collection("catalog").findOne({ item_id: _id }).then((product) => {
                if (product != null) {
                    db.collection("cart").findOne({ user_id: user_id }).then((_cart) => {
                        if (_cart == null) {
                            // cart doesn't exist
                            db.collection("cart").insertOne({
                                user_id: user_id,
                                items: [{ id: _id, qty: 1 }]
                            }).then((__r) => {
                                res.send({ status: kSuccess });
                            });
                            return;
                        }

                        // cart exists
                        db.collection("cart").findOne({
                            user_id: user_id,
                            items: { $elemMatch: { id: _id } }
                        }).then(product_in_cart => {
                            if (product_in_cart == null) {
                                // cart exists, but item not added
                                _cart.items.push({
                                    id: _id,
                                    qty: 1
                                });
                                db.collection("cart").updateOne({ user_id: user_id }, { $set: { items: _cart.items } }).then((db_action_result) => {
                                    if (db_action_result != null) {
                                        res.send({ status: kSuccess });
                                    } else {
                                        res.send({ status: "error" });
                                    }
                                });
                                return;
                            }

                            for (let i = 0; i < _cart.items.length; i++) {
                                if (_cart.items[i].id == _id) {
                                    _cart.items[i].qty++;
                                    break;
                                }
                            }

                            db.collection("cart").updateOne({ user_id: user_id }, { $set: { items: _cart.items } }).then((db_action_result) => {
                                if (db_action_result != null) {
                                    res.send({ status: kSuccess });
                                } else {
                                    res.send({ status: "error" });
                                }
                            });
                        });

                    });
                } else {
                    res.send({ status: "error", message: "product item not found" });
                }
            });
        }
    });
});

app.get("/cart/show", (req, res) => {
    session_process(req, res, () => {
        db.collection("cart").findOne({ user_id: req.userdata.session.data.user_id }).then((_cart) => {
            let output = { status: kSuccess, count: 0, items: [] };
            if (_cart != null) {
                for (let i = 0; i < _cart.items.length; i++) {
                    output.items.push(_cart.items[i]);
                    output.count += _cart.items[i].qty;
                }
            }
            res.send(output);
        });
    });
});

app.post("/user/create", (req, res) => {
    session_validate(req, res, (is_valid) => {
        if (is_valid) {
            res.send({ status: "error", message: "not allowed in session" });
            return;
        }

        // check user's email exists or not
        db.collection("users").findOne({ email: req.body.email }).then((result) => {
            if (result == null) {
                // account does not exists
                db.collection("users").insertOne({
                    email: req.body.email,
                    pass: md5(req.body.pass)
                }).then((_result) => {
                    if (_result !== null && _result.acknowledged == true) {
                        res.send({ status: kSuccess, message: "user account created" });
                    }
                });
            } else {
                res.send({ status: "error", message: "user account exists" });
            }
        }).catch((err) => {
            res.send({ status: "error", message: "user check error", _err: err });
        });
    });
});

function GenerateSessionId(length) {
    let result = "";
    const characters = "abcdefghijklmnopqrstuvwxyz";
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter++;
    }
    return result;
}

app.post("/user/login", (req, res) => {
    // check user's email exists or not
    db.collection("users").findOne({ email: req.body.email }).then((result) => {
        if (result == null) {
            // account does not exists
            res.send({ status: "error", message: "user account does not exists" });
        } else {
            if (result.pass == md5(req.body.pass)) {
                // create session in db
                db.collection("session").findOne({ user_id: req.body.email }).then((_session) => {
                    if (_session == null) {
                        let sess_id = GenerateSessionId(16);
                        db.collection("session").insertOne({
                            id: sess_id,
                            user_id: req.body.email,
                            created_time: Date.now(),
                            access_count: 0
                        }).then((_) => {
                            res.cookie("FSID", sess_id);
                            log.debug("Session Created: " + sess_id);
                            res.send({ status: kSuccess, message: "login success" });
                        });
                    } else {
                        res.cookie("FSID", _session.id);
                        res.send({ status: kSuccess, message: "login success" });
                    }
                });
            } else {
                res.send({ status: "error", message: "incorrect password" });
            }
        }
    }).catch((err) => {
        res.send({ status: "error", message: "user check error", _err: err });
    });
});

app.get("/user/is_logged_in", (req, res) => {
    session_process(req, res, () => {
        res.send({ logged: true });
    });
});

app.get("/user/logout", (req, res) => {
    session_process(req, res, () => {
        // remove from db
        db.collection("session").deleteOne({ id: req.userdata.session.FSID }).then((_) => { }).finally(() => {
            res.cookie("FSID", "", { maxAge: 0 });
            log.debug("Session Destroy: " + req.userdata.session.FSID);
            res.send({ status: kSuccess });
        });
    });
});

app.get("/admin/catalog/update", (req, res) => {
    res.send([]);

    fs.readFile("test.csv", 'ascii', (err, data) => {
        db.collection("catalog").deleteMany({}).then((_result) => {
            let lines = data.split("\r\n");
            lines.forEach((line) => {
                if (line != '') {
                    let parts = line.split(",");
                    // console.log(parts);
                    db.collection("catalog").insertOne({
                        item_id: parseInt(parts[0]),
                        item_name: parts[1],
                        item_price: parseFloat(parts[2]),
                        item_photo: parts[3]
                    }).then((result) => {
                        console.log(result);
                    });
                }
            });
        });
    });
});

app.listen(8081, function () {
    log.info("Food Ordering App() running successfully on 8081.");
});
