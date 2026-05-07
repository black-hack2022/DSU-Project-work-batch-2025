<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Capturing Image</title>
</head>
<body>
    <%
        String user=request.getParameter("user").toString();
        if(user== null){
        user="";
        
        }
    
    %>
<%= "Welcome "+user%>
	<div><video id="videoID" autoplay style="border: 1px solid black; margin-left: 200px; margin-top: 200px;"></video></div>
	<div><canvas id="canvasID" style="border: 1px solid black; margin-left: 200px; margin-top: 200px;"></canvas></div>
   	<div>
   		<input type="button" value="Take Photo" onclick="capture()" style="width: 200px; height: 30px; margin-left: 106px;"/>
   		<input type="button" value="Send" onclick="send()" style="width: 200px; height: 30px; margin-left: 106px;"/>
   	</div>

	<script type="text/javascript">

		var video = document.getElementById('videoID');
		var canvas = document.getElementById('canvasID');
		var context = canvas.getContext('2d');

		window.URL = window.URL || window.webkitURL;
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia	|| 
                                 navigator.mozGetUserMedia || navigator.msGetUserMedia;

		navigator.getUserMedia({
			video : true
		}, function(stream) {
			video.src = window.URL.createObjectURL(stream);
		}, function(e) { console.log('Something wrong has happened:', e); });

		
		function capture() 
		{
			context.drawImage(video, 0, 0, canvas.width, canvas.height);
		};

		
		function send()
        {
			var imageData =  canvas.toDataURL();
			var xmlhttp = new XMLHttpRequest();
			xmlhttp.open("POST", "ImageReceive.jsp?user=<%=user%>", true);
			xmlhttp.send(imageData);
                        if (window.XMLHttpRequest)
          {// code for IE7+, Firefox, Chrome, Opera, Safari
          xmlhttp=new XMLHttpRequest();
          }
        else
          {// code for IE6, IE5
          xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
          }
        xmlhttp.onreadystatechange=function()
          {
          if (xmlhttp.readyState==4 && xmlhttp.status==200)
            {
            document.getElementById("aa").innerHTML=xmlhttp.responseText;
            document.getElementById("ms").innerHTML=xmlhttp.responseText;
            }
          }
          xmlhttp.open("POST", "ImageReceive.jsp?user=<%=user%>", true);
			xmlhttp.send(imageData);              
        }
        

	</script>
       
          <div id="ms" style=" color: red;font-size: 50px; margin-left: 806px; margin-top: -709px;"></div>
</body>
</html>
