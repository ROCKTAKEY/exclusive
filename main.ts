declare const firebase: typeof import("firebase");
declare const firebaseui: typeof import("firebaseui");

var ref = firebase.database().ref();

var ui = new firebaseui.auth.AuthUI(firebase.auth());

var currentGame = null;

const initMoney = 7500;

const colorBonus = 0.25;

const houseBonus = 1;

const tax = 200;

const housePriceRate = 1;

const rentRate = 0.75;

function updateGameListView (outline: firebase.database.DataSnapshot) {
    if (outline == null) return;
    let list = document.getElementById("game-list-view");
    list.innerHTML = "";
    for(let gameid in outline.val()){
        let gameSummary = outline.val()[gameid];

        let listOfElement = document.createElement("div");
        listOfElement.classList.add("game-list-element");
        listOfElement.addEventListener("click", function(){
            goRoom(participateRoom(gameid, outline.child(gameid)));
        });

        let gameidElement = document.createElement("div");
        gameidElement.classList.add("gameid");
        gameidElement.textContent = gameid;
        listOfElement.appendChild(gameidElement);

        let gamestateElement = document.createElement("span");
        gamestateElement.classList.add("gamestate");
        gamestateElement.textContent = gameSummary["state"];
        listOfElement.appendChild(gamestateElement);

        let userlistElement = document.createElement("span");
        userlistElement.classList.add("userlist");
        userlistElement.textContent =
            Object.keys(gameSummary["users"]).map(i => gameSummary["users"][i].name).join(", ");
        listOfElement.appendChild(userlistElement);
        list.insertBefore(listOfElement, list.firstChild);
    }
}

function participateRoom(gameid: string, gameOutline: firebase.database.DataSnapshot){
    let users = gameOutline.child("users").val();
    let user = firebase.auth().currentUser;
    if(!user) return null;

    if (users && Object.keys(users).filter((key) => users[key]["id"] == user.uid).length)
        return gameid;

    const userNum = users ? Object.keys(users).length.toString() : "0";
    ref.child("outline").child(gameid).child("users").child(userNum).set(
        {
            name: user.displayName,
            id: user.uid
        }
    );

    let thisGame = ref.child("detail").child(gameid);

    thisGame.child("users").child(userNum).set(
        {
            id: user.uid,
            name: user.displayName,
            state: "prepare",
            money: initMoney,
            position: 0,
        }
    );
    return gameid;
}

function createRoom(snapshot: firebase.database.DataSnapshot){
    var user = firebase.auth().currentUser;
    if (!user) return null;

    let room = ref.child("outline").push(
        { state: "prepare" });
    ref.child("detail").child(room.key).set({
        field: createNewField(),
        who: null,
        phase: "prepare",
    });
    return participateRoom(room.key, snapshot.child("outline").child(room.key));
}

function goRoom(gameid: string | null){
    if(!gameid) return;
    if (currentGame) return;
    currentGame = gameid;
    document.getElementById("game").style.display = "block";
    document.getElementById("not-game").style.display = "none";
    document.getElementById("game-gameid").textContent = currentGame;
    ref.child("detail").child(gameid).on("value", updateGame);
    ref.child("detail").child(gameid).on("value", startGame);
}

function exitRoom(){
    if (!currentGame) return;
    currentGame = null;
    document.getElementById("game").style.display = "none";
    document.getElementById("not-game").style.display = "block";
}

function removeRoom(gameid: string){
    ref.child("outline").child(gameid).remove();
    ref.child("detail").child(gameid).remove();
}

function removeThisRoom(){
    if(window.confirm("Really delete this room?")){
        removeRoom(currentGame);
        exitRoom();
    }
}

function createNewField(){
    let field = {};
    for (var i = 0; i < 40; i++) {
        if (i % 10 == 0) continue;
        field[i] = { owner: null, house: 0, value: (i % 5 + 1) * 100 };
    }
    return field;
}

function startGame(snapshotGameDetail: firebase.database.DataSnapshot) {
    if( snapshotGameDetail.child("phase").val() != "prepare" ||
        Object.keys(snapshotGameDetail.child("users").val()).filter(function (key){
            return snapshotGameDetail.child("users").val()[key]["state"] == "prepare";
        }).length != 0 ||
        getUserNumFromUserid(firebase.auth().currentUser.uid, snapshotGameDetail) != 0)
        return;
    ref.child("outline").child(currentGame).child("state").set("playing");
    ref.child("detail").child(currentGame).child("phase").set("main");
    ref.child("detail").child(currentGame).child("who").set(0);
}

function getUserNameFromUserNum(userNum: Number, snapshotGameDetail: firebase.database.DataSnapshot) {
    return snapshotGameDetail.child("users").val()[userNum.toString()]["name"];
}

function getUserNumFromUserid(userid: string, snapshotGameDetail: firebase.database.DataSnapshot) {
    let users = snapshotGameDetail.child("users").val();
    return Number(Object.keys(users).filter((key) => users[key]["id"] == userid)[0]);
}

function getCurrentUserNum(snapshotGameDetail: firebase.database.DataSnapshot){
    return getUserNumFromUserid(firebase.auth().currentUser.uid, snapshotGameDetail);
}

function updateGame(snapshotGameDetail: firebase.database.DataSnapshot) {
    if (!snapshotGameDetail) {
        alert("The room seems to be removed.");
        exitRoom();
        return;
    }

    let phase: string = snapshotGameDetail.child("phase").val();
    document.getElementById("phase-title").textContent = phase + " phase";
    if(snapshotGameDetail.child("who").val() != null)
        document.getElementById("phase-who").textContent =
        getUserNameFromUserNum(snapshotGameDetail.child("who").val(), snapshotGameDetail) || "";
    document.getElementById("phase-content").innerHTML = "";
    document.getElementById("phase-message").textContent = "";

    displayUserList(snapshotGameDetail);
    displayField(snapshotGameDetail);
    displayMessage(snapshotGameDetail);

    switch(phase){
        case "prepare":
            displayPreparePhase(snapshotGameDetail);
            break;
        case "main":
            if(snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail))
                displayMainPhase(snapshotGameDetail);
            break;
        case "land":
            if(snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail))
                displayLandPhase(snapshotGameDetail);
            break;
        case "propose":
            if (snapshotGameDetail.child("propose").child("type").val() == "buy" &&
                snapshotGameDetail.child("field").child(
                    snapshotGameDetail.child("propose").val()?.land.toString()
                ).child("owner").val() == getCurrentUserNum(snapshotGameDetail)){
                displayProposePhaseBuy(snapshotGameDetail);
            } else if (snapshotGameDetail.child("propose").child("type").val() == "sell" &&
                snapshotGameDetail.child("propose").val()?.to == getCurrentUserNum(snapshotGameDetail)){
                displayProposePhaseSell(snapshotGameDetail);
            }
            break;
        case "end":
            if(snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail))
                displayEndPhase(snapshotGameDetail);
            break;
        default:
    }
}

function displayPreparePhase(snapshotGameDetail: firebase.database.DataSnapshot) {
    let phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent = "";

    let phaseContent = document.getElementById("phase-content");
    let label = document.createElement("label");
    label.htmlFor = "ready-button";
    label.textContent = "Ready";

    let checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "ready-button";
    checkbox.checked = snapshotGameDetail.child("users").child(
        getUserNumFromUserid(firebase.auth().currentUser.uid, snapshotGameDetail).toString()
    ).child("state").val() == "ready";
    checkbox.addEventListener("change", function() {
        setPrepare(this.checked,
                   getUserNumFromUserid(firebase.auth().currentUser.uid,
                                        snapshotGameDetail));
    });

    phaseContent.insertBefore(label, document.getElementById("phase-content").firstChild);
    phaseContent.insertBefore(checkbox, document.getElementById("phase-content").firstChild);

}

function displayMainPhase(snapshotGameDetail: firebase.database.DataSnapshot) {
    let phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent = "";

    let phaseContent = document.getElementById("phase-content");
    let diceButton = document.createElement("button");
    diceButton.textContent = "Dice";
    diceButton.classList.add("dice-button");
    diceButton.addEventListener("click", function() {
        diceButton.disabled = true;
        rollDice(snapshotGameDetail);
    });
    phaseContent.appendChild(diceButton);
}

function displayLandPhase(snapshotGameDetail: firebase.database.DataSnapshot) {
    let fieldNum = snapshotGameDetail.child("users")
        .child(getCurrentUserNum(snapshotGameDetail).toString()).child("position").val();
    let owner = snapshotGameDetail.child("field").child(fieldNum).child("owner").val();
    if (fieldNum % 10 == 0) {
        displayLandPhaseFree(snapshotGameDetail);
    }
    else if (owner == null){
        displayLandPhaseBuy(snapshotGameDetail, fieldNum);
    } else if (owner == getCurrentUserNum(snapshotGameDetail)) {
        displayLandPhaseHouse(snapshotGameDetail, fieldNum);
    } else {
        displayLandPhasePay(snapshotGameDetail, fieldNum);
    }
}

function displayLandPhaseFree(snapshotGameDetail: firebase.database.DataSnapshot) {
    let phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent = "Here is free land. You don't have to pay any.";

    let phaseContent = document.getElementById("phase-content");
    let OKButton = document.createElement("button");
    OKButton.textContent = "OK";
    OKButton.classList.add("OKButton");
    OKButton.addEventListener("click", function() {
        OKButton.disabled = true;
        ref.child("detail").child(currentGame).child("phase").set("end");
    });
    phaseContent.appendChild(OKButton);
}

function displayLandPhaseBuy(snapshotGameDetail: firebase.database.DataSnapshot, fieldNum: number) {
    let value = snapshotGameDetail.child("field").child(fieldNum.toString()).child("value").val();

    let phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent =
        "You can buy the land " + fieldNum.toString() + " for $" + value.toString() + ".";

    let phaseContent = document.getElementById("phase-content");

    let buyButton = document.createElement("button");
    buyButton.classList.add("buy-button");
    buyButton.textContent = "Buy";
    buyButton.addEventListener("click", function(){
        buyButton.disabled = true;
        getLand(snapshotGameDetail, fieldNum);
        payMoney(snapshotGameDetail, value);
        ref.child("detail").child(currentGame).child("phase").set("end");
        addMessage(
            getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
                + " bought the land " + fieldNum.toString() + " for $" + value.toString() + "."
        );
    });

    let notBuyButton = document.createElement("button");
    notBuyButton.classList.add("not-buy-button");
    notBuyButton.textContent = "Don't buy";
    notBuyButton.addEventListener("click", function(){
        notBuyButton.disabled = true;
        ref.child("detail").child(currentGame).child("phase").set("end");
    });

    phaseContent.appendChild(buyButton);
    phaseContent.appendChild(notBuyButton);
}

function displayLandPhaseHouse(snapshotGameDetail: firebase.database.DataSnapshot, fieldNum: number){
    let houseValue = snapshotGameDetail.child("field").child(fieldNum.toString()).child("value").val() * housePriceRate;
    let phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent =
        "This land " + snapshotGameDetail.child("users").child(getCurrentUserNum(snapshotGameDetail).toString()).child("position").val()
        +" is yours. Buy house for $" + houseValue.toString() + " here?";

    let phaseContent = document.getElementById("phase-content");
    let buyButton = document.createElement("button");
    buyButton.classList.add("buy-button");
    buyButton.textContent = "Buy";
    buyButton.addEventListener("click", function(){
        buyButton.disabled = true;
        getHouse(snapshotGameDetail, fieldNum);
        payMoney(snapshotGameDetail, houseValue);
        ref.child("detail").child(currentGame).child("phase").set("end");
        addMessage(
            getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
                + " bought a house for $" + houseValue.toString() + " on the land "
                + fieldNum.toString() + "."
        );
    });

    let notBuyButton = document.createElement("button");
    notBuyButton.classList.add("not-buy-button");
    notBuyButton.textContent = "Don't buy";
    notBuyButton.addEventListener("click", function(){
        notBuyButton.disabled = true;
        ref.child("detail").child(currentGame).child("phase").set("end");
    });

    phaseContent.appendChild(buyButton);
    phaseContent.appendChild(notBuyButton);
}

function displayLandPhasePay(snapshotGameDetail: firebase.database.DataSnapshot, fieldNum: number){
    let land = snapshotGameDetail.child("field").child(fieldNum.toString()).val();
    let ownerNum = land.owner;
    let ownerName = snapshotGameDetail.child("users").child(ownerNum.toString()).child("name").val();

    let rent = calcRent(
        land,
        Object.keys(snapshotGameDetail.child("field").val()).filter(function (key){
            return snapshotGameDetail.child("field").val()[key].owner == ownerNum;
        }).filter(function (key){
            return Number(key) % 10 == fieldNum % 10;
        }).length == 4
    );

    let phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent = "You have to pay $" + rent.toString() +
        " to " + ownerName + " as rent.";

    let phaseContent = document.getElementById("phase-content");
    let OKButton = document.createElement("button");
    OKButton.textContent = "OK";
    OKButton.classList.add("OKButton");
    OKButton.addEventListener("click", function() {
        OKButton.disabled = true;
        payMoney(snapshotGameDetail, rent);
        getMoneyWho(snapshotGameDetail, rent, ownerNum);
        ref.child("detail").child(currentGame).child("phase").set("end");
        addMessage(
            getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
                + " paid $" + rent.toString() + " to "
                + ownerName + " as rent."
        );
    });
    phaseContent.appendChild(OKButton);
}

function displayProposePhaseSell(snapshotGameDetail: firebase.database.DataSnapshot){
    let propose = snapshotGameDetail.child("propose").val();
    let seller = snapshotGameDetail.child("who").val();
    let sellerName = getUserNameFromUserNum(seller, snapshotGameDetail);
    let price = propose.price;
    let land = propose.land;
    let phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent =
        sellerName + " want you to buy the land " + land + " for $" + price.toString() + ".";

    let phaseContent = document.getElementById("phase-content");

    let buyButton = document.createElement("button");
    buyButton.classList.add("buy-button");
    buyButton.textContent = "Buy";
    buyButton.addEventListener("click", function() {
        buyButton.disabled = true;
        getLand(snapshotGameDetail, land);
        payMoney(snapshotGameDetail, price);
        getMoneyWho(snapshotGameDetail, price, seller);
        ref.child("detail").child(currentGame).child("propose").set(null);
        ref.child("detail").child(currentGame).child("phase").set("main");
        addMessage(
            getUserNameFromUserNum(seller, snapshotGameDetail)
                + " sold the land " + land.toString() + " to "
                + getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
                + " for $" + price.toString() + "."
        );
    });

    let notBuyButton = document.createElement("button");
    notBuyButton.classList.add("not-buy-button");
    notBuyButton.textContent = "Don't buy";
    notBuyButton.addEventListener("click", function(){
        notBuyButton.disabled = true;
        ref.child("detail").child(currentGame).child("propose").set(null);
        ref.child("detail").child(currentGame).child("phase").set("main");
        addMessage("The proposal was rejected.");

    });

    phaseContent.appendChild(buyButton);
    phaseContent.appendChild(notBuyButton);
}

function displayProposePhaseBuy(snapshotGameDetail: firebase.database.DataSnapshot) {
    let propose = snapshotGameDetail.child("propose").val();
    let buyer = snapshotGameDetail.child("who").val();
    let buyerName = getUserNameFromUserNum(buyer, snapshotGameDetail);
    let price = propose.price;
    let land = propose.land;
    let phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent =
        buyerName + " want you to sell the land " + land + " for $" + price.toString() + ".";

    let phaseContent = document.getElementById("phase-content");

    let buyButton = document.createElement("button");
    buyButton.classList.add("buy-button");
    buyButton.textContent = "Sell";
    buyButton.addEventListener("click", function(){
        buyButton.disabled = true;
        getMoney(snapshotGameDetail, price);
        getLandWho(snapshotGameDetail, land, buyer);
        payMoneyWho(snapshotGameDetail, price, buyer);
        ref.child("detail").child(currentGame).child("propose").set(null);
        ref.child("detail").child(currentGame).child("phase").set("main");
        addMessage(
            getUserNameFromUserNum(buyer, snapshotGameDetail)
                + " buy the land " + land.toString() + " from "
                + getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
                + " for $" + price.toString() + "."
        );
    });

    let notBuyButton = document.createElement("button");
    notBuyButton.classList.add("not-buy-button");
    notBuyButton.textContent = "Don't sell";
    notBuyButton.addEventListener("click", function(){
        notBuyButton.disabled = true;
        ref.child("detail").child(currentGame).child("propose").set(null);
        ref.child("detail").child(currentGame).child("phase").set("main");
        addMessage("The proposal was rejected.");
    });

    phaseContent.appendChild(buyButton);
    phaseContent.appendChild(notBuyButton);
}

function displayEndPhase(snapshotGameDetail: firebase.database.DataSnapshot) {
    let phaseMessage = document.getElementById("phase-message");
    phaseMessage.textContent = "You have to pay $" + tax.toString() + " as tax.";

    let phaseContent = document.getElementById("phase-content");
    let OKButton = document.createElement("button");
    OKButton.textContent = "OK";
    OKButton.classList.add("OKButton");
    OKButton.addEventListener("click", function() {
        OKButton.disabled = true;
        turnEnd(snapshotGameDetail);
    });
    phaseContent.appendChild(OKButton);
}

function displayUserList(snapshotGameDetail: firebase.database.DataSnapshot) {
    let users = snapshotGameDetail.child("users").val();
    let userList = document.getElementById("user-list-main");
    userList.innerHTML = "";
    for(let key in users) {
        let user = users[key];
        let userNum = Number(key);
        let listOfElement = document.createElement("div");
        listOfElement.classList.add("user-list-element");
        if (user.dead)
            listOfElement.classList.add("dead");

        let title = document.createElement("h3");
        title.textContent = key + ": " + user.name + " at " + user.position;
        listOfElement.appendChild(title);

        let money = document.createElement("span");
        money.classList.add("money");
        money.textContent = user.money.toString();
        listOfElement.appendChild(money);

        let ownerTable = document.createElement("div");
        ownerTable.classList.add("owner-table");

        let field = snapshotGameDetail.child("field").val();
        for(let key in field) {
            if (field[key].owner == userNum) {
                let cell = document.createElement("span");
                cell.classList.add("mod" + Number(key) % 10);
                cell.classList.add("cell");
                cell.addEventListener("click", function(){
                    displayLandInfo(snapshotGameDetail, Number(key));
                })

                let house = document.createElement("span");
                house.classList.add("house");
                house.textContent = field[key].house;
                cell.appendChild(house);

                let num = document.createElement("span");
                num.classList.add("num");
                num.textContent = key;
                cell.appendChild(num);

                let money = document.createElement("span");
                money.classList.add("money");
                money.textContent = (field[key].value * (1 + field[key].house * housePriceRate))
                                       .toString();
                cell.appendChild(money);

                ownerTable.appendChild(cell);
            }
        }
        listOfElement.appendChild(ownerTable);

        userList.appendChild(listOfElement);
    }
}

function displayField(snapshotGameDetail: firebase.database.DataSnapshot) {
    let posToNum = [];
    for(let key in snapshotGameDetail.child("users").val()) {
        if (!posToNum[snapshotGameDetail.child("users").val()[key]["position"]])
            posToNum[snapshotGameDetail.child("users").val()[key]["position"]] = [];
        posToNum[snapshotGameDetail.child("users").val()[key]["position"]]
            .push(Number(key));
    }
    for (let i = 0; i < 40; i++) {
        let cellName = "cell" + ("0" + i).slice(-2);
        let cell = document.getElementById(cellName);

        if (posToNum[i]) cell.classList.add("pinned");
        else cell.classList.remove("pinned");

        if (snapshotGameDetail.child("propose").val() && snapshotGameDetail.child("propose").child("land").val() == i)
            cell.classList.add("proposed");
        else cell.classList.remove("proposed");

        let house = cell.getElementsByClassName("house")[0];
        let owner = cell.getElementsByClassName("owner")[0];
        let others = cell.getElementsByClassName("others")[0];
        if (i % 10 != 0){
            house.textContent = snapshotGameDetail.child("field").child(i.toString())
                .child("house").val().toString();
            let ownerNum = snapshotGameDetail.child("field").child(i.toString())
                .child("owner").val();
            owner.textContent = ownerNum == null ? "" : ownerNum.toString();
            cell.addEventListener("click", function(){
                displayLandInfo(snapshotGameDetail, i);
            });
        }

        others.textContent = posToNum[i] ? posToNum[i].join(", ") : "";

    }
}

function displayMessage(snapshotGameDetail: firebase.database.DataSnapshot) {
    let messageList = snapshotGameDetail.child("message").val();
    let messageArea = document.getElementById("message");
    messageArea.innerHTML = "";

    for(let key in messageList) {
        let ele = document.createElement("div");
        ele.classList.add("message-element");
        ele.textContent = messageList[key];
        messageArea.insertBefore(ele, messageArea.firstChild);
    }
}

function displayLandInfo(snapshotGameDetail: firebase.database.DataSnapshot, fieldNum: number){
    let land = snapshotGameDetail.child("field").child(fieldNum.toString()).val();

    let owner = land["owner"];
    let ownerName = owner == null ? "-" :
        snapshotGameDetail.child("users").child(owner.toString()).child("name").val();

    let infoElement = document.getElementById("info");
    infoElement.innerHTML = "";
    let ul = document.createElement("ul");

    let fieldNumberElement = document.createElement("li");
    fieldNumberElement.textContent = "Field Number: " + fieldNum.toString();
    ul.appendChild(fieldNumberElement);

    let ownerElement = document.createElement("li");
    ownerElement.textContent =
        "Owner: " + ownerName;
    ul.appendChild(ownerElement);

    let valueElement = document.createElement("li");
    valueElement.textContent = "Value: " + land.value.toString() + "(base)" +
        (land.house ? " + " + (land.house * housePriceRate * land.value).toString()
            + "(house)" : "");
    ul.appendChild(valueElement);

    if (snapshotGameDetail.child("phase").val() == "main"
        && snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail)){
        if(owner == getCurrentUserNum(snapshotGameDetail)){
            let sellToElement = document.createElement("li");
            sellToElement.textContent =
                "Sell to(put user number): ";
            let sellTo = document.createElement("input");
            sellTo.type = "number";
            sellTo.min = "0";
            sellTo.max = (snapshotGameDetail.child("users").val().length - 1).toString();
            sellTo.id = "sell-to";
            sellToElement.appendChild(sellTo);
            ul.appendChild(sellToElement);

            let sellValueElement = document.createElement("li");
            sellValueElement.textContent =
                "Sell for($): ";
            let sellValue = document.createElement("input");
            sellValue.type = "number";
            sellValue.min = "0";
            sellValue.id = "sell-value";
            sellValueElement.appendChild(sellValue);
            ul.appendChild(sellValueElement);

            let sellButtonElement = document.createElement("li");
            let sellButton = document.createElement("button");
            sellButton.textContent = "Propose to buy";
            sellButton.addEventListener("click", function(){
                if (sellValue.value && sellTo.value){
                sellButton.disabled = true;
                proposeSell(snapshotGameDetail,
                            Number(sellValue.value), fieldNum, Number(sellTo.value));
                }
            });
            sellButtonElement.appendChild(sellButton);
            ul.appendChild(sellButtonElement);
        } else if (owner != null) {
            let buyValueElement = document.createElement("li");
            buyValueElement.textContent =
                "Buy for($): ";
            let buyValue = document.createElement("input");
            buyValue.type = "number";
            buyValue.min = "0";
            buyValue.max = snapshotGameDetail.child("users").child(
                getCurrentUserNum(snapshotGameDetail).toString()
            ).child("money").val();
            buyValue.id = "buy-value";
            buyValueElement.appendChild(buyValue);
            ul.appendChild(buyValueElement);

            let buylButtonElement = document.createElement("li");
            let buyButton = document.createElement("button");
            buyButton.textContent = "Propose to sell"
            buyButton.addEventListener("click", function(){
                if (buyValue.value){
                    buyButton.disabled = true;
                    proposeBuy(snapshotGameDetail, Number(buyValue.value), fieldNum);
                }
            });
            buylButtonElement.appendChild(buyButton);
            ul.appendChild(buylButtonElement);
        }
    }
    infoElement.appendChild(ul);
}

function addMessage(message: string){
    ref.child("detail").child(currentGame).child("message").push(message);
}

function setPrepare(value: boolean, userNum: Number) {
    ref.child("detail").child(currentGame).child("users").child(userNum.toString()).child("state").set(
        value ? "ready" : "prepare"
    );
}

function rollDice(snapshotGameDetail: firebase.database.DataSnapshot){
    let dice = Math.floor( Math.random() * 11 ) + 2;
    let now = snapshotGameDetail.child("users")
        .child(getCurrentUserNum(snapshotGameDetail).toString()).child("position").val();

    ref.child("detail").child(currentGame).child("users")
        .child(getCurrentUserNum(snapshotGameDetail).toString())
        .child("position").set((now + dice) % 40);
    ref.child("detail").child(currentGame).child("phase").set("land");

    addMessage(
        getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail)
            + " went forward " + dice.toString() + " squares."
    );
}

function getLandWho(snapshotGameDetail: firebase.database.DataSnapshot, fieldNum: number, userNum: number){
    ref.child("detail").child(currentGame).child("field").child(fieldNum.toString()).child("owner")
        .set(userNum);
}

function getLand(snapshotGameDetail: firebase.database.DataSnapshot, fieldNum: number){
    getLandWho(snapshotGameDetail, fieldNum, getCurrentUserNum(snapshotGameDetail));
}

function getHouse(snapshotGameDetail: firebase.database.DataSnapshot, fieldNum: number){
    let houseNow = snapshotGameDetail.child("field").child(fieldNum.toString()).child("house").val();
    ref.child("detail").child(currentGame).child("field").child(fieldNum.toString()).child("house")
        .set(houseNow + 1);
}

function payMoneyWho(snapshotGameDetail: firebase.database.DataSnapshot, price: number, userNum: number) {
    let money = snapshotGameDetail.child("users").child(userNum.toString()).child("money").val();
    ref.child("detail").child(currentGame).child("users").child(userNum.toString())
        .child("money").set(money - price);

}

function getMoneyWho(snapshotGameDetail: firebase.database.DataSnapshot, price: number, userNum: number) {
    payMoneyWho(snapshotGameDetail, -price, userNum);
}

function payMoney(snapshotGameDetail: firebase.database.DataSnapshot, price: number) {
    payMoneyWho(snapshotGameDetail, price, getCurrentUserNum(snapshotGameDetail));
}

function getMoney(snapshotGameDetail: firebase.database.DataSnapshot, price: number) {
    getMoneyWho(snapshotGameDetail, price, getCurrentUserNum(snapshotGameDetail));
}

function payTax(snapshotGameDetail: firebase.database.DataSnapshot) {
    payMoney(snapshotGameDetail, tax);
}

function calcRent(land, bonusp: boolean) {
    return ((land.house * houseBonus + 1) * land.value) * (1 + (bonusp ? colorBonus : 0)) * rentRate;
}

function proposeSell(snapshotGameDetail: firebase.database.DataSnapshot,
                     price: number, fieldNum: number, buyerid: number) {
    if (snapshotGameDetail.child("phase").val() == "main" &&
        snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail)) {
        let propose = ref.child("detail").child(currentGame).child("propose");
        propose.child("type").set("sell");
        propose.child("price").set(price);
        propose.child("land").set(fieldNum);
        propose.child("to").set(buyerid);
        ref.child("detail").child(currentGame).child("phase").set("propose");
    }
}

function proposeBuy(snapshotGameDetail: firebase.database.DataSnapshot,
                    price: number, fieldNum: number) {
    if (snapshotGameDetail.child("phase").val() == "main" &&
        snapshotGameDetail.child("who").val() == getCurrentUserNum(snapshotGameDetail)) {
        let propose = ref.child("detail").child(currentGame).child("propose");
        propose.child("type").set("buy");
        propose.child("price").set(price);
        propose.child("land").set(fieldNum);
        ref.child("detail").child(currentGame).child("phase").set("propose");
    }
}

function turnEnd(snapshotGameDetail: firebase.database.DataSnapshot){
    const now = snapshotGameDetail.child("who").val();
    payTax(snapshotGameDetail);

    addMessage(
        getUserNameFromUserNum(
            getCurrentUserNum(snapshotGameDetail), snapshotGameDetail) + " paid $" + tax.toString() + " as tax. "
    );

    if (snapshotGameDetail.child("users").child(now.toString()).child("money").val() <= 0) {
        ref.child("detail").child(currentGame).child("users").child(now.toString()).child("dead").set(true);
        addMessage(getUserNameFromUserNum(getCurrentUserNum(snapshotGameDetail), snapshotGameDetail) + " was died.");
        for(let key in Object.keys(snapshotGameDetail.child("field").val())) {
            if(snapshotGameDetail.child("field").child(key).child("owner").val() == getCurrentUserNum(snapshotGameDetail)){
                ref.child("detail").child(currentGame).child("field").child(key).child("house").set(0);
                ref.child("detail").child(currentGame).child("field").child(key).child("owner").set(null);
            }
        }
    }

    let winner = searchWinner(snapshotGameDetail);

    if (winner) {
        ref.child("detail").child(currentGame).child("state").set("finished");
        ref.child("detail").child(currentGame).child("phase").set("finished");
        addMessage("The game was over. The winner is " + getUserNameFromUserNum(Number(winner), snapshotGameDetail) + "!");
        return;
    }

    let next = (now + 1) % snapshotGameDetail.child("users").val().length;
    let tmp = snapshotGameDetail.child("users").val().length;
    while(snapshotGameDetail.child("users").child(next.toString()).child("dead").val() && tmp--)
        next = (next + 1) % snapshotGameDetail.child("users").val().length;

    ref.child("detail").child(currentGame).child("who").set(next);
    ref.child("detail").child(currentGame).child("phase").set("main");

    addMessage("Next turn is for " + getUserNameFromUserNum(next, snapshotGameDetail) + ".");
}

function searchWinner(snapshotGameDetail: firebase.database.DataSnapshot){
    let survivers = Object.keys(snapshotGameDetail.child("users").val()).filter(function(key){
        return !snapshotGameDetail.child("users").child(key).child("dead").val();
    });
    if (survivers.length == 1)
        return survivers[0];
    else
        return null;
}

function setupEvents() {
    ref.child("outline").on("value", function (snapshot: firebase.database.DataSnapshot) {
        updateGameListView(snapshot);
    });
    ui.start("#firebaseui-auth-container", {
        signInOptions: [
            firebase.auth.EmailAuthProvider.PROVIDER_ID,
        ],
        signInFlow: "popup",
        callbacks: {
            signInSuccessWithAuthResult: function(_, __) { return false; },
            uiShown: function(){
                document.getElementById("auth-loader").style.display = "none";
            },
        },
    });

    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            document.getElementById("signed").textContent = "Hello, " + user.displayName + ".";
            document.getElementById("firebaseui-auth-container").style.display = "none";
            document.getElementById("logout").style.display = "block";

        } else {
            document.getElementById("signed").textContent = "";
            document.getElementById("firebaseui-auth-container").style.display = "block";
            document.getElementById("logout").style.display = "none";

        }
    });
    document.getElementById("logout").addEventListener("click", function(){
        firebase.auth().signOut().then(function(){});
    });

    document.getElementById("newroom").addEventListener("click", function (){
        ref.once('value').then(function(snapshot: firebase.database.DataSnapshot){
            goRoom(createRoom(snapshot));
        });
    });
    document.getElementById("remove-game").addEventListener("click", removeThisRoom);
}

window.addEventListener("load", setupEvents);
