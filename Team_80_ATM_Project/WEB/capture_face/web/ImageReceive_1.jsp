
<%@page import="Logic.ImageResizer"%>
<%@page import="java.awt.image.BufferedImage"%>
<%@page import="javax.imageio.ImageIO"%>
<%@page import="java.awt.Image"%>

<%@page import="java.util.Random"%>
<%@page import="java.io.FileOutputStream"%>
<%@page import="java.io.File"%>
<%@page import="sun.misc.BASE64Decoder"%>
<%@page import="java.io.Reader"%>
<%
 String aa="saved";  
//private static final long serialVersionUID = 1L;
String user=request.getParameter("user").toString();
user=user.substring(1, user.length()-1);
System.out.println("???"+user);
try
		{
			StringBuffer buffer = new StringBuffer();
			Reader reader = request.getReader();
			int current;

			while((current = reader.read()) >= 0)
				buffer.append((char) current);
			
			String data = new String(buffer);
			data = data.substring(data.indexOf(",") + 1);

			

			FileOutputStream output = new FileOutputStream(new File("/E:/ATM WITH FACE RFID FINGER PRINT/atm/gallery/" + 
			user+ ".png"));

			output.write(new BASE64Decoder().decodeBuffer(data));
			output.flush();
			output.close();
                        
                        
                        ImageResizer ir=new ImageResizer();
                        Image img = null;
                        img = ImageIO.read(new File("E:/ATM WITH FACE RFID FINGER PRINT/atm/gallery/"+user+".png"));
                        BufferedImage tempPNG = null;
                        tempPNG = ir.resizeImage(img, 70, 70);
                        File newFilePNG = null;
                        newFilePNG = new File("E:/ATM WITH FACE RFID FINGER PRINT/atm/gallery/"+user+".png");
                        ImageIO.write(tempPNG, "png", newFilePNG);
                        
                        
                        
                     
                       
                        
                        
		}
		catch (Exception e)
		{
			e.printStackTrace();
		}

%>
 <option value="<%=aa%>" ><%=aa%></option>