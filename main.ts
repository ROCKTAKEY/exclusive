declare const firebase: typeof import("firebase");
declare const firebaseui: typeof import("firebaseui");

var ref = firebase.database().ref();

var ui = new firebaseui.auth.AuthUI(firebase.auth());

function updateGameListView (outline: any) {
    if (outline == null) return;
    let list = document.getElementById("game-list-view");
    for (var i = 0; i < outline.length; i++) {
        let listOfElement = document.createElement("div");
        listOfElement.classList.add("game-list-element");

        list.insertBefore(listOfElement, list.firstChild);
    }
}

function setupEvents() {
    ref.child("outline").on("value", function (snapshot: firebase.database.DataSnapshot) {
        updateGameListView(snapshot.val() || []);
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
            document.getElementById("signed").innerHTML = "Hello, " + user.displayName + ".";
            document.getElementById("firebaseui-auth-container").style.display = "none";
            document.getElementById("logout").style.display = "block";

        } else {
            document.getElementById("signed").innerHTML = "";
            document.getElementById("firebaseui-auth-container").style.display = "block";
            document.getElementById("logout").style.display = "none";

        }
    });
    document.getElementById("logout").addEventListener("click", function(){
        firebase.auth().signOut().then(function(){});
    });
}

window.addEventListener("load", setupEvents);
