$.ajax({
    method: "GET",
    url: "/user/is_logged_in"
}).done((e) => {
    if (e.logged !== undefined && e.logged === true) {
        $(".logged_in").removeClass("logged_in");
        cart_refresh();
    } else {
        $(".not_logged_in").removeClass("not_logged_in");
    }
});

function btn_cart_add__action(event) {
    let item_id = $(event.target).data("item-id");
    $.ajax({
        url: '/cart/add/' + item_id
    }).done(function (response) {
        cart_refresh();
    });
}

$("._btn_cart_add").click(btn_cart_add__action);

const user = {
    create: function () {
        $.ajax({
            method: "POST",
            url: "/user/create",
            data: JSON.stringify({
                email: $("#form-user-create-email").val(),
                pass: $("#form-user-create-password").val()
            }),
            contentType: "application/json"
        }).done((data) => {
            console.log(data);
            if (data.status == "success") {
                $("#result-user-create").text("User account created, please login.");
                $("#form-user-create-email").val("");
                $("#form-user-create-password").val("")
            } else {
                $("#result-user-create").text(data.message);
            }
        });
    },
    login: function () {
        $.ajax({
            method: "POST",
            url: "/user/login",
            data: JSON.stringify({
                email: $("#form-user-login-email").val(),
                pass: $("#form-user-login-password").val()
            }),
            contentType: "application/json"
        }).done((data) => {
            // console.log(data);
            if (data.status == "success") {
                location.reload();
            }
        });
    },
    logout: function () {
        $.ajax({
            method: "GET",
            url: "/user/logout"
        }).done((data) => {
            if (data.status == "success") {
                location.reload();
            }
        });
    }
}

$("#btn-user-create").click((e) => {
    user.create();
});

$("#btn-user-login").click((e) => {
    user.login();
});

$("#btn-user-logout").click((e) => {
    user.logout();
});

let cart = {
    items: []
}

function cart_refresh() {
    $.ajax({
        method: "GET",
        url: "/cart/show"
    }).done((e) => {
        if (e.status == "success") {
            $("#cart-items-count").text(e.count);
            $("#cart-view-data-table tbody").empty();
            let total_cart_price = 0;
            for (let i = 0; i < e.items.length; i++) {
                let tt = e.items[i];
                // tt.id, tt.qty

                // cart.items.push({
                //     image: catalog[tt.id].image,
                //     name: catalog[tt.id].name,
                //     qty: tt.qty,
                //     unit_price: catalog[tt.id].price,
                //     total_price: catalog[tt.id].price * tt.qty
                // });

                total_cart_price += catalog[tt.id].price * tt.qty;
                $("#cart-view-data-table tbody").append(
                    "<tr>" +
                    "<td><img src=\"/images/" + catalog[tt.id].image + "\" height=\"32\"><br>" + catalog[tt.id].name + "</td>" +
                    "<td>" + tt.qty + "</td>" +
                    "<td>" + catalog[tt.id].price + "</td>" +
                    "<td>" + catalog[tt.id].price * tt.qty + "</td>" +
                    "</tr>");
            }

            $("#cart-view-data-table tbody").append("<tr><td></td><td></td><td>Total Price</td><td>" + total_cart_price + "</td></tr>");
        } else {
            $("#cart-items-count").text(0);
        }
    });
}

$("#btn-cart-refresh").click((e) => {
    cart_refresh();
});

let catalog = {};

$.ajax({
    method: 'GET',
    url: '/catalog/items'
}).done((e) => {
    if (e.status == "success") {
        for (let i = 0; i < e.data.length; i++) {
            let tt = e.data[i];
            // console.log(tt);

            $("#catalog").append(
                "<div class=\"col-2\">" +
                "<div style=\"border-radius: 5px; border: 1px solid #ccc; padding: 5px;\">" +
                "<div style=\"height: 128px\">" +
                "<img src=\"/images/" + tt.item_photo + "\" width=\"128\">" +
                "</div>" +
                "<div>" + tt.item_name + "</div>" +
                "<div>Price: " + tt.item_price + "</div>" +
                "<div style=\"text-align: right; padding-bottom: 10px; padding-right: 10px;\">" +
                "<button class=\"btn btn-primary btn-sm _btn_cart_add\" data-item-id=\"" + tt.item_id + "\">Add</button>" +
                "</div>" +
                "</div>" +
                "</div>");

            catalog[tt.item_id] = {
                name: tt.item_name,
                price: tt.item_price,
                image: tt.item_photo
            };
        }

        $("._btn_cart_add").click(btn_cart_add__action);
    }
});

$("#btn-cart-view").click((e) => {
    $("#cart-view-container").fadeIn(200);
});
$("#btn-cart-view-close").click((e) => {
    $("#cart-view-container").fadeOut(200);
});