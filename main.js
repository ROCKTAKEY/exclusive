var ref = firebase.database().ref();
var ui = new firebaseui.auth.AuthUI(firebase.auth());
var currentGame = null;
var initMoney = 7500;
var colorBonus = 0.25;
var houseBonus = 1;
var tax = 200;
var housePriceRate = 1;
function updateGameListView(outline) {
    if (outline == null)
        return;
    var list = document.getElementById("game-list-view");
    list.innerHTML = "";
    var _loop_1 = function (gameid) {
        var gameSummary = outline.val()[gameid];
        var listOfElement = document.createElement("div");
        listOfElement.classList.add("game-list-element");
        listOfElement.addEventListener("click", function () {
            goRoom(participateRoom(gameid, outline.child(gameid)));
        });
        var gameidElement = document.createElement("div");
        gameidElement.classList.add("gameid");
        gameidElement.textContent = gameid;
        listOfElement.appendChild(gameidElement);
        var gamestateElement = document.createElement("span");
        gamestateElement.classList.add("gamestate");
        gamestateElement.textContent = gameSummary["state"];
        listOfElement.appendChild(gamestateElement);
        var userlistElement = document.createElement("span");
        userlistElement.classList.add("userlist");
        userlistElement.textContent =
            Object.keys(gameSummary["users"]).map(function (i) { return gameSummary["users"][i].name; }).join(", ");
        listOfElement.appendChild(userlistElement);
        list.insertBefore(listOfElement, list.firstChild);
    };
    for (var gameid in outline.val()) {
        _loop_1(gameid);
    }
}
function participateRoom(gameid, gameOutline) {
    var users = gameOutline.child("users").val();
    var user = firebase.auth().currentUser;
    if (!user)
        return null;
    if (users && Object.keys(users).filter(function (key) { return users[key]["id"] == user.uid; }).length)
        return gameid;
    var userNum = users ? Object.keys(users).length.toString() : "0";
    ref.child("outline").child(gameid).child("users").child(userNum).set({
        name: user.displayName,
        id: user.uid
    });
    var thisGame = ref.child("detail").child(gameid);
    thisGame.child("users").child(userNum).set({
        id: user.uid,
        name: user.displayName,
        state: "prepare",
        money: initMoney,
        position: 0
    });
    return gameid;
}
function createRoom(snapshot) {
    var user = firebase.auth().currentUser;
    if (!user)
        return null;
    var room = ref.child("outline").push({ state: "prepare" });
    ref.child("detail").child(room.key).set({
        field: createNewField(),
        who: null,
        phase: "prepare"
    });
    return participateRoom(room.key, snapshot.child("outline").child(room.key));
}
function goRoom(gameid) {
    if (!gameid)
        return;
    if (currentGame)
        return;
    currentGame = gameid;
    document.getElementById("game").style.display = "block";
    document.getElementById("not-game").style.display = "none";
    document.getElementById("game-gameid").textContent = currentGame;
    ref.child("detail").child(gameid).on("value", updateGame);
    ref.child("detail").child(gameid).on("value", startGame);
}
function exitRoom() {
    if (!currentGame)
        return;
    currentGame = null;
    document.getElementById("game").style.display = "none";
    document.getElementById("not-game").style.display = "block";
}
function removeRoom(gameid) {
    ref.child("outline").child(gameid).remove();
    ref.child("detail").child(gameid).remove();
}
function removeThisRoom() {
    if (window.confirm("Really delete this room?")) {
        removeRoom(currentGame);
        exitRoom();
    }
}
function createNewField() {
    var field = {};
    for (var i = 0; i < 40; i++) {
        if (i % 10 == 0)
            continue;
        field[i] = { owner: null, house: 0, value: (i % 5 + 1) * 100 };
    }
    return field;
}
function startGame(snapshotGameDetail) {
    if (snapshotGameDetail.child("phase").val() != "prepare" ||
        Object.keys(snapshotGameDetail.child("users").val()).filter(function (key) {
            return snapshotGameDetail.child("users").val()[key]["state"] == "prepare";
        }).length != 0 ||
        getUserNumFromUserid(firebase.auth().currentUser.uid, snapshotGameDetail) != 0)
        return;
    ref.child("outline").child(currentGame).child("state").set("playing");
    ref.child("detail").child(currentGame).child("phase").set("main");
    ref.child("detail").child(currentGame).child("who").set(0);
}
function getUserNameFromUserNum(userNum, snapshotGameDetail) {
    return snapshotGameDetail.child("users").val()[userNum.toString()]["name"];
}
function getUserNumFromUserid(userid, snapshotGameDetail) {
    var users = snapshotGameDetail.child("users").val();
    return Number(Object.keys(users).filter(function (key) { return users[key]["id"] == userid; })[0]);
}
function getCurrentUserNum(snapshotGameDetail) {
    return getUserNumFromUserid(firebase.auth().currentUser.uid, snapshotGameDetail);
}
function updateGame(snapshotGameDetail) {
    var _a, _b;
    if (!snapshotGameDetail) {
        alert("The room seems to be removed.");
        exitRoom();
        return;
    }
    var phase = snapshotGameDetail.child("phase").val();
    document.getElementById("phase-title").textContent = phase + " phase";
    if (snapshotGameDetail.child("who").val() != null)
        document.getElementById("phase-who").textContent =
            getUserNameFromUserNum(snapshotGameDetail.child("who").val(), snapshotGameDetail) || "";
    document.getElementById("phase-content").innerHTML = "";
    document.getElementById("phase-message").textContent = "";
    displayUserList(snapshotGameDetail);
    displayField(snapshotGameDetail);
    displayMessage(snapshotGameDetail);
    switch (phase) {
        case "prepare":
            displayPreparePhase(snapshotGameDetail);
            break;
        case "main":
            if (snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail))
                displayMainPhase(snapshotGameDetail);
            break;
        case "land":
            if (snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail))
                displayLandPhase(snapshotGameDetail);
            break;
        case "propose":
            if (snapshotGameDetail.child("propose").child("type").val() == "buy" &&
                snapshotGameDetail.child("field").child((_a = snapshotGameDetail.child("propose").val()) === null || _a === void 0 ? void 0 : _a.land.toString()).child("owner").val() == getCurrentUserNum(snapshotGameDetail)) {
                displayProposePhaseBuy(snapshotGameDetail);
            }
            else if (snapshotGameDetail.child("propose").child("type").val() == "sell" &&
                ((_b = snapshotGameDetail.child("propose").val()) === null || _b === void 0 ? void 0 : _b.to) == getCurrentUserNum(snapshotGameDetail)) {
                displayProposePhaseSell(snapshotGameDetail);
            }
            break;
        case "end":
            if (snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail))
                displayEndPhase(snapshotGameDetail);
            break;
        default:
    }
}
function displayPreparePhase(snapshotGameDetail) {
    var phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent = "";
    var phaseContent = document.getElementById("phase-content");
    var label = document.createElement("label");
    label.htmlFor = "ready-button";
    label.textContent = "Ready";
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "ready-button";
    checkbox.checked = snapshotGameDetail.child("users").child(getUserNumFromUserid(firebase.auth().currentUser.uid, snapshotGameDetail).toString()).child("state").val() == "ready";
    checkbox.addEventListener("change", function () {
        setPrepare(this.checked, getUserNumFromUserid(firebase.auth().currentUser.uid, snapshotGameDetail));
    });
    phaseContent.insertBefore(label, document.getElementById("phase-content").firstChild);
    phaseContent.insertBefore(checkbox, document.getElementById("phase-content").firstChild);
}
function displayMainPhase(snapshotGameDetail) {
    var phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent = "";
    var phaseContent = document.getElementById("phase-content");
    var diceButton = document.createElement("button");
    diceButton.textContent = "Dice";
    diceButton.classList.add("dice-button");
    diceButton.addEventListener("click", function () {
        diceButton.disabled = true;
        rollDice(snapshotGameDetail);
    });
    phaseContent.appendChild(diceButton);
}
function displayLandPhase(snapshotGameDetail) {
    var fieldNum = snapshotGameDetail.child("users")
        .child(getCurrentUserNum(snapshotGameDetail).toString()).child("position").val();
    var owner = snapshotGameDetail.child("field").child(fieldNum).child("owner").val();
    if (fieldNum % 10 == 0) {
        displayLandPhaseFree(snapshotGameDetail);
    }
    else if (owner == null) {
        displayLandPhaseBuy(snapshotGameDetail, fieldNum);
    }
    else if (owner == getCurrentUserNum(snapshotGameDetail)) {
        displayLandPhaseHouse(snapshotGameDetail, fieldNum);
    }
    else {
        displayLandPhasePay(snapshotGameDetail, fieldNum);
    }
}
function displayLandPhaseFree(snapshotGameDetail) {
    var phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent = "Here is free land. You don't have to pay any.";
    var phaseContent = document.getElementById("phase-content");
    var OKButton = document.createElement("button");
    OKButton.textContent = "OK";
    OKButton.classList.add("OKButton");
    OKButton.addEventListener("click", function () {
        OKButton.disabled = true;
        ref.child("detail").child(currentGame).child("phase").set("end");
    });
    phaseContent.appendChild(OKButton);
}
function displayLandPhaseBuy(snapshotGameDetail, fieldNum) {
    var value = snapshotGameDetail.child("field").child(fieldNum.toString()).child("value").val();
    var phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent =
        "You can buy the land " + fieldNum.toString() + " for $" + value.toString() + ".";
    var phaseContent = document.getElementById("phase-content");
    var buyButton = document.createElement("button");
    buyButton.classList.add("buy-button");
    buyButton.textContent = "Buy";
    buyButton.addEventListener("click", function () {
        buyButton.disabled = true;
        getLand(snapshotGameDetail, fieldNum);
        payMoney(snapshotGameDetail, value);
        ref.child("detail").child(currentGame).child("phase").set("end");
        addMessage(getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
            + " bought the land " + fieldNum.toString() + " for $" + value.toString() + ".");
    });
    var notBuyButton = document.createElement("button");
    notBuyButton.classList.add("not-buy-button");
    notBuyButton.textContent = "Don't buy";
    notBuyButton.addEventListener("click", function () {
        notBuyButton.disabled = true;
        ref.child("detail").child(currentGame).child("phase").set("end");
    });
    phaseContent.appendChild(buyButton);
    phaseContent.appendChild(notBuyButton);
}
function displayLandPhaseHouse(snapshotGameDetail, fieldNum) {
    var houseValue = snapshotGameDetail.child("field").child(fieldNum.toString()).child("value").val() * housePriceRate;
    var phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent =
        "This land " + snapshotGameDetail.child("users").child(getCurrentUserNum(snapshotGameDetail).toString()).child("position").val()
            + " is yours. Buy house for $" + houseValue.toString() + " here?";
    var phaseContent = document.getElementById("phase-content");
    var buyButton = document.createElement("button");
    buyButton.classList.add("buy-button");
    buyButton.textContent = "Buy";
    buyButton.addEventListener("click", function () {
        buyButton.disabled = true;
        getHouse(snapshotGameDetail, fieldNum);
        payMoney(snapshotGameDetail, houseValue);
        ref.child("detail").child(currentGame).child("phase").set("end");
        addMessage(getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
            + " bought a house for $" + houseValue.toString() + " on the land "
            + fieldNum.toString() + ".");
    });
    var notBuyButton = document.createElement("button");
    notBuyButton.classList.add("not-buy-button");
    notBuyButton.textContent = "Don't buy";
    notBuyButton.addEventListener("click", function () {
        notBuyButton.disabled = true;
        ref.child("detail").child(currentGame).child("phase").set("end");
    });
    phaseContent.appendChild(buyButton);
    phaseContent.appendChild(notBuyButton);
}
function displayLandPhasePay(snapshotGameDetail, fieldNum) {
    var land = snapshotGameDetail.child("field").child(fieldNum.toString()).val();
    var ownerNum = land.owner;
    var ownerName = snapshotGameDetail.child("users").child(ownerNum.toString()).child("name").val();
    var rent = calcRent(land, Object.keys(snapshotGameDetail.child("field").val()).filter(function (key) {
        return snapshotGameDetail.child("field").val()[key].owner == ownerNum;
    }).filter(function (key) {
        return Number(key) % 10 == fieldNum % 10;
    }).length == 4);
    var phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent = "You have to pay $" + rent.toString() +
        " to " + ownerName + " as rent.";
    var phaseContent = document.getElementById("phase-content");
    var OKButton = document.createElement("button");
    OKButton.textContent = "OK";
    OKButton.classList.add("OKButton");
    OKButton.addEventListener("click", function () {
        OKButton.disabled = true;
        payMoney(snapshotGameDetail, rent);
        getMoneyWho(snapshotGameDetail, rent, ownerNum);
        ref.child("detail").child(currentGame).child("phase").set("end");
        addMessage(getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
            + " paid $" + rent.toString() + " to "
            + ownerName + " as rent.");
    });
    phaseContent.appendChild(OKButton);
}
function displayProposePhaseSell(snapshotGameDetail) {
    var propose = snapshotGameDetail.child("propose").val();
    var seller = snapshotGameDetail.child("who").val();
    var sellerName = getUserNameFromUserNum(seller, snapshotGameDetail);
    var price = propose.price;
    var land = propose.land;
    var phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent =
        sellerName + " want you to buy the land " + land + " for $" + price.toString() + ".";
    var phaseContent = document.getElementById("phase-content");
    var buyButton = document.createElement("button");
    buyButton.classList.add("buy-button");
    buyButton.textContent = "Buy";
    buyButton.addEventListener("click", function () {
        buyButton.disabled = true;
        getLand(snapshotGameDetail, land);
        payMoney(snapshotGameDetail, price);
        getMoneyWho(snapshotGameDetail, price, seller);
        ref.child("detail").child(currentGame).child("propose").set(null);
        ref.child("detail").child(currentGame).child("phase").set("main");
        addMessage(getUserNameFromUserNum(seller, snapshotGameDetail)
            + " sold the land " + land.toString() + " to "
            + getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
            + " for $" + price.toString() + ".");
    });
    var notBuyButton = document.createElement("button");
    notBuyButton.classList.add("not-buy-button");
    notBuyButton.textContent = "Don't buy";
    notBuyButton.addEventListener("click", function () {
        notBuyButton.disabled = true;
        ref.child("detail").child(currentGame).child("propose").set(null);
        ref.child("detail").child(currentGame).child("phase").set("main");
        addMessage("The proposal was rejected.");
    });
    phaseContent.appendChild(buyButton);
    phaseContent.appendChild(notBuyButton);
}
function displayProposePhaseBuy(snapshotGameDetail) {
    var propose = snapshotGameDetail.child("propose").val();
    var buyer = snapshotGameDetail.child("who").val();
    var buyerName = getUserNameFromUserNum(buyer, snapshotGameDetail);
    var price = propose.price;
    var land = propose.land;
    var phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent =
        buyerName + " want you to sell the land " + land + " for $" + price.toString() + ".";
    var phaseContent = document.getElementById("phase-content");
    var buyButton = document.createElement("button");
    buyButton.classList.add("buy-button");
    buyButton.textContent = "Sell";
    buyButton.addEventListener("click", function () {
        buyButton.disabled = true;
        getMoney(snapshotGameDetail, price);
        getLandWho(snapshotGameDetail, land, buyer);
        payMoneyWho(snapshotGameDetail, price, buyer);
        ref.child("detail").child(currentGame).child("propose").set(null);
        ref.child("detail").child(currentGame).child("phase").set("main");
        addMessage(getUserNameFromUserNum(buyer, snapshotGameDetail)
            + " buy the land " + land.toString() + " from "
            + getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
            + " for $" + price.toString() + ".");
    });
    var notBuyButton = document.createElement("button");
    notBuyButton.classList.add("not-buy-button");
    notBuyButton.textContent = "Don't sell";
    notBuyButton.addEventListener("click", function () {
        notBuyButton.disabled = true;
        ref.child("detail").child(currentGame).child("propose").set(null);
        ref.child("detail").child(currentGame).child("phase").set("main");
        addMessage("The proposal was rejected.");
    });
    phaseContent.appendChild(buyButton);
    phaseContent.appendChild(notBuyButton);
}
function displayEndPhase(snapshotGameDetail) {
    var phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent = "You have to pay $" + tax.toString() + " as tax.";
    var phaseContent = document.getElementById("phase-content");
    var OKButton = document.createElement("button");
    OKButton.textContent = "OK";
    OKButton.classList.add("OKButton");
    OKButton.addEventListener("click", function () {
        OKButton.disabled = true;
        turnEnd(snapshotGameDetail);
    });
    phaseContent.appendChild(OKButton);
}
function displayUserList(snapshotGameDetail) {
    var users = snapshotGameDetail.child("users").val();
    var userList = document.getElementById("user-list-main");
    userList.innerHTML = "";
    for (var key in users) {
        var user = users[key];
        var userNum = Number(key);
        var listOfElement = document.createElement("div");
        listOfElement.classList.add("user-list-element");
        var title = document.createElement("h3");
        title.textContent = key + ": " + user.name + " at " + user.position;
        listOfElement.appendChild(title);
        var money = document.createElement("span");
        money.classList.add("money");
        money.textContent = user.money.toString();
        listOfElement.appendChild(money);
        var ownerTable = document.createElement("div");
        ownerTable.classList.add("owner-table");
        var field = snapshotGameDetail.child("field").val();
        var _loop_2 = function (key_1) {
            if (field[key_1].owner == userNum) {
                var cell = document.createElement("span");
                cell.classList.add("mod" + Number(key_1) % 10);
                cell.classList.add("cell");
                cell.addEventListener("click", function () {
                    displayLandInfo(snapshotGameDetail, Number(key_1));
                });
                var house = document.createElement("span");
                house.classList.add("house");
                house.textContent = field[key_1].house;
                cell.appendChild(house);
                var num = document.createElement("span");
                num.classList.add("num");
                num.textContent = key_1;
                cell.appendChild(num);
                var money_1 = document.createElement("span");
                money_1.classList.add("money");
                money_1.textContent = (field[key_1].value * (1 + field[key_1].house * housePriceRate))
                    .toString();
                cell.appendChild(money_1);
                ownerTable.appendChild(cell);
            }
        };
        for (var key_1 in field) {
            _loop_2(key_1);
        }
        listOfElement.appendChild(ownerTable);
        userList.appendChild(listOfElement);
    }
}
function displayField(snapshotGameDetail) {
    var posToNum = [];
    for (var key in snapshotGameDetail.child("users").val()) {
        if (!posToNum[snapshotGameDetail.child("users").val()[key]["position"]])
            posToNum[snapshotGameDetail.child("users").val()[key]["position"]] = [];
        posToNum[snapshotGameDetail.child("users").val()[key]["position"]]
            .push(Number(key));
    }
    var _loop_3 = function (i) {
        var cellName = "cell" + ("0" + i).slice(-2);
        var cell = document.getElementById(cellName);
        if (posToNum[i])
            cell.classList.add("pinned");
        else
            cell.classList.remove("pinned");
        if (snapshotGameDetail.child("propose").val() && snapshotGameDetail.child("propose").child("land").val() == i)
            cell.classList.add("proposed");
        else
            cell.classList.remove("proposed");
        var house = cell.getElementsByClassName("house")[0];
        var owner = cell.getElementsByClassName("owner")[0];
        var others = cell.getElementsByClassName("others")[0];
        if (i % 10 != 0) {
            house.textContent = snapshotGameDetail.child("field").child(i.toString())
                .child("house").val().toString();
            var ownerNum = snapshotGameDetail.child("field").child(i.toString())
                .child("owner").val();
            owner.textContent = ownerNum == null ? "" : ownerNum.toString();
            cell.addEventListener("click", function () {
                displayLandInfo(snapshotGameDetail, i);
            });
        }
        others.textContent = posToNum[i] ? posToNum[i].join(", ") : "";
    };
    for (var i = 0; i < 40; i++) {
        _loop_3(i);
    }
}
function displayMessage(snapshotGameDetail) {
    var messageList = snapshotGameDetail.child("message").val();
    var messageArea = document.getElementById("message");
    messageArea.innerHTML = "";
    for (var key in messageList) {
        var ele = document.createElement("div");
        ele.classList.add("message-element");
        ele.textContent = messageList[key];
        messageArea.insertBefore(ele, messageArea.firstChild);
    }
}
function displayLandInfo(snapshotGameDetail, fieldNum) {
    var land = snapshotGameDetail.child("field").child(fieldNum.toString()).val();
    var owner = land["owner"];
    var ownerName = owner == null ? "-" :
        snapshotGameDetail.child("users").child(owner.toString()).child("name").val();
    var infoElement = document.getElementById("info");
    infoElement.innerHTML = "";
    var ul = document.createElement("ul");
    var fieldNumberElement = document.createElement("li");
    fieldNumberElement.textContent = "Field Number: " + fieldNum.toString();
    ul.appendChild(fieldNumberElement);
    var ownerElement = document.createElement("li");
    ownerElement.textContent =
        "Owner: " + ownerName;
    ul.appendChild(ownerElement);
    var valueElement = document.createElement("li");
    valueElement.textContent = "Value: " + land.value.toString() + "(base)" +
        (land.house ? " + " + (land.house * housePriceRate * land.value).toString()
            + "(house)" : "");
    ul.appendChild(valueElement);
    if (snapshotGameDetail.child("phase").val() == "main"
        && snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail)) {
        if (owner == getCurrentUserNum(snapshotGameDetail)) {
            var sellToElement = document.createElement("li");
            sellToElement.textContent =
                "Sell to(put user number): ";
            var sellTo_1 = document.createElement("input");
            sellTo_1.type = "number";
            sellTo_1.min = "0";
            sellTo_1.max = (snapshotGameDetail.child("users").val().length - 1).toString();
            sellTo_1.id = "sell-to";
            sellToElement.appendChild(sellTo_1);
            ul.appendChild(sellToElement);
            var sellValueElement = document.createElement("li");
            sellValueElement.textContent =
                "Sell for($): ";
            var sellValue_1 = document.createElement("input");
            sellValue_1.type = "number";
            sellValue_1.min = "0";
            sellValue_1.id = "sell-value";
            sellValueElement.appendChild(sellValue_1);
            ul.appendChild(sellValueElement);
            var sellButtonElement = document.createElement("li");
            var sellButton_1 = document.createElement("button");
            sellButton_1.textContent = "Propose to buy";
            sellButton_1.addEventListener("click", function () {
                if (sellValue_1.value && sellTo_1.value) {
                    sellButton_1.disabled = true;
                    proposeSell(snapshotGameDetail, Number(sellValue_1.value), fieldNum, Number(sellTo_1.value));
                }
            });
            sellButtonElement.appendChild(sellButton_1);
            ul.appendChild(sellButtonElement);
        }
        else if (owner != null) {
            var buyValueElement = document.createElement("li");
            buyValueElement.textContent =
                "Buy for($): ";
            var buyValue_1 = document.createElement("input");
            buyValue_1.type = "number";
            buyValue_1.min = "0";
            buyValue_1.max = snapshotGameDetail.child("users").child(getCurrentUserNum(snapshotGameDetail).toString()).child("money").val();
            buyValue_1.id = "buy-value";
            buyValueElement.appendChild(buyValue_1);
            ul.appendChild(buyValueElement);
            var buylButtonElement = document.createElement("li");
            var buyButton_1 = document.createElement("button");
            buyButton_1.textContent = "Propose to sell";
            buyButton_1.addEventListener("click", function () {
                if (buyValue_1.value) {
                    buyButton_1.disabled = true;
                    proposeBuy(snapshotGameDetail, Number(buyValue_1.value), fieldNum);
                }
            });
            buylButtonElement.appendChild(buyButton_1);
            ul.appendChild(buylButtonElement);
        }
    }
    infoElement.appendChild(ul);
}
function addMessage(message) {
    ref.child("detail").child(currentGame).child("message").push(message);
}
function setPrepare(value, userNum) {
    ref.child("detail").child(currentGame).child("users").child(userNum.toString()).child("state").set(value ? "ready" : "prepare");
}
function rollDice(snapshotGameDetail) {
    var dice = Math.floor(Math.random() * 11) + 2;
    var now = snapshotGameDetail.child("users")
        .child(getCurrentUserNum(snapshotGameDetail).toString()).child("position").val();
    ref.child("detail").child(currentGame).child("users")
        .child(getCurrentUserNum(snapshotGameDetail).toString())
        .child("position").set((now + dice) % 40);
    ref.child("detail").child(currentGame).child("phase").set("land");
    addMessage(getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
        + " went forward " + dice.toString() + " squares.");
}
function getLandWho(snapshotGameDetail, fieldNum, userNum) {
    ref.child("detail").child(currentGame).child("field").child(fieldNum.toString()).child("owner")
        .set(userNum);
}
function getLand(snapshotGameDetail, fieldNum) {
    getLandWho(snapshotGameDetail, fieldNum, getCurrentUserNum(snapshotGameDetail));
}
function getHouse(snapshotGameDetail, fieldNum) {
    var houseNow = snapshotGameDetail.child("field").child(fieldNum.toString()).child("house").val();
    ref.child("detail").child(currentGame).child("field").child(fieldNum.toString()).child("house")
        .set(houseNow + 1);
}
function payMoneyWho(snapshotGameDetail, price, userNum) {
    var money = snapshotGameDetail.child("users").child(userNum.toString()).child("money").val();
    ref.child("detail").child(currentGame).child("users").child(userNum.toString())
        .child("money").set(money - price);
}
function getMoneyWho(snapshotGameDetail, price, userNum) {
    payMoneyWho(snapshotGameDetail, -price, userNum);
}
function payMoney(snapshotGameDetail, price) {
    payMoneyWho(snapshotGameDetail, price, getCurrentUserNum(snapshotGameDetail));
}
function getMoney(snapshotGameDetail, price) {
    getMoneyWho(snapshotGameDetail, price, getCurrentUserNum(snapshotGameDetail));
}
function payTax(snapshotGameDetail) {
    payMoney(snapshotGameDetail, tax);
}
function calcRent(land, bonusp) {
    return ((land.house * houseBonus + 1) * land.value) * (1 + (bonusp ? colorBonus : 0)) / 2;
}
function proposeSell(snapshotGameDetail, price, fieldNum, buyerid) {
    if (snapshotGameDetail.child("phase").val() == "main" &&
        snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail)) {
        var propose = ref.child("detail").child(currentGame).child("propose");
        propose.child("type").set("sell");
        propose.child("price").set(price);
        propose.child("land").set(fieldNum);
        propose.child("to").set(buyerid);
        ref.child("detail").child(currentGame).child("phase").set("propose");
    }
}
function proposeBuy(snapshotGameDetail, price, fieldNum) {
    if (snapshotGameDetail.child("phase").val() == "main" &&
        snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail)) {
        var propose = ref.child("detail").child(currentGame).child("propose");
        propose.child("type").set("buy");
        propose.child("price").set(price);
        propose.child("land").set(fieldNum);
        ref.child("detail").child(currentGame).child("phase").set("propose");
    }
}
function turnEnd(snapshotGameDetail) {
    var now = snapshotGameDetail.child("who").val();
    payTax(snapshotGameDetail);
    if (snapshotGameDetail.child("users").child(now.toString()).child("money").val() <= 0) {
        ref.child("detail").child(currentGame).child("users").child(now.toString()).child("dead").set(true);
        for (var key in Object.keys(snapshotGameDetail.child("field").val())) {
            if (snapshotGameDetail.child("field").child(key).child("owner").val() == getCurrentUserNum(snapshotGameDetail)) {
                ref.child("detail").child(currentGame).child("field").child(key).child("house").set(0);
                ref.child("detail").child(currentGame).child("field").child(key).child("owner").set(null);
                addMessage(getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail) + " was died.");
            }
        }
    }
    var next = (now + 1) % snapshotGameDetail.child("users").val().length;
    while (snapshotGameDetail.child("users").child(next.toString()).child("dead").val())
        next = (next + 1) % snapshotGameDetail.child("users").val().length;
    ref.child("detail").child(currentGame).child("who").set(next);
    ref.child("detail").child(currentGame).child("phase").set("main");
    addMessage(getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
        + " paid $" + tax.toString() + " as tax. "
        + "Next turn is for " + getUserNameFromUserNum(next, snapshotGameDetail) + ".");
}
function setupEvents() {
    ref.child("outline").on("value", function (snapshot) {
        updateGameListView(snapshot);
    });
    ui.start("#firebaseui-auth-container", {
        signInOptions: [
            firebase.auth.EmailAuthProvider.PROVIDER_ID,
        ],
        signInFlow: "popup",
        callbacks: {
            signInSuccessWithAuthResult: function (_, __) { return false; },
            uiShown: function () {
                document.getElementById("auth-loader").style.display = "none";
            }
        }
    });
    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            document.getElementById("signed").textContent = "Hello, " + user.displayName + ".";
            document.getElementById("firebaseui-auth-container").style.display = "none";
            document.getElementById("logout").style.display = "block";
        }
        else {
            document.getElementById("signed").textContent = "";
            document.getElementById("firebaseui-auth-container").style.display = "block";
            document.getElementById("logout").style.display = "none";
        }
    });
    document.getElementById("logout").addEventListener("click", function () {
        firebase.auth().signOut().then(function () { });
    });
    document.getElementById("newroom").addEventListener("click", function () {
        ref.once('value').then(function (snapshot) {
            goRoom(createRoom(snapshot));
        });
    });
    document.getElementById("remove-game").addEventListener("click", removeThisRoom);
}
window.addEventListener("load", setupEvents);
