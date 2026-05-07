<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Capturing Image</title>
</head>
<body>

<%
    String user = request.getParameter("user");
    if(user == null){
        user = "";
    }
%>

<h2><%= "Welcome " + user %></h2>

<div>
    <video id="videoID" autoplay width="400" height="300" style="border:1px solid black;"></video>
</div>

<div>
    <canvas id="canvasID" width="400" height="300" style="border:1px solid black;"></canvas>
</div>

<div>
    <input type="button" value="Take Photo" onclick="capture()" />
    <input type="button" value="Send" onclick="send()" />
</div>

<div id="ms" style="color:red;font-size:20px;"></div>

<script>

var video = document.getElementById('videoID');
var canvas = document.getElementById('canvasID');
var context = canvas.getContext('2d');

// ? Modern Camera Access
navigator.mediaDevices.getUserMedia({ video: true })
.then(function(stream) {
    video.srcObject = stream;
})
.catch(function(err) {
    console.log("Camera error: ", err);
});

// Capture image
function capture() {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
}

// Send image to server
function send() {

    var imageData = canvas.toDataURL("image/png");

    var xmlhttp = new XMLHttpRequest();

    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
            document.getElementById("ms").innerHTML = xmlhttp.responseText;
        }
    };

    xmlhttp.open("POST", "ImageReceive.jsp?user=<%=user%>", true);
    xmlhttp.setRequestHeader("Content-Type", "application/upload");
    xmlhttp.send(imageData);
}

</script>

</body>
</html>