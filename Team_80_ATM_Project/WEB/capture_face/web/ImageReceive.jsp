<%@page import="java.io.File"%>
<%@page import="java.io.FileWriter"%>
<%
    String user=request.getParameter("user").toString();
user=user.substring(1, user.length()-1);
System.out.println("???"+user);
String data = request.getReader().readLine();

data = data.substring(data.indexOf(",") + 1); // remove header

byte[] imageBytes = java.util.Base64.getDecoder().decode(data);

// Save file
//String filePath = application.getRealPath("/") + "images/" + System.currentTimeMillis() + ".png";
String filePath = "C:/Users/Rahul/Downloads/ATM WITH FACE FINGER PRINT/face_recogniton/Test/" + "a.jpg";

java.io.FileOutputStream fos = new java.io.FileOutputStream(filePath);
fos.write(imageBytes);
fos.close();
File f=new File("C:/Users/Rahul/Downloads/ATM WITH FACE FINGER PRINT/face_recogniton/Test/aadhaar.txt");
FileWriter  fw=new FileWriter(f);
fw.write(user);
fw.close();
File f1=new File("C:/Users/Rahul/Downloads/ATM WITH FACE FINGER PRINT/face_recogniton/readdata.txt");
FileWriter  fw1=new FileWriter(f1);
fw1.write("read");
fw1.close();
out.println("Image Saved Successfully!");
%>