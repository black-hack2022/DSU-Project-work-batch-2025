/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package logic;


import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.swing.JOptionPane;
import user.Rfid;
import user.user_type;

/**
 *
 * @author sumit
 */
public class listenReader extends Thread{
    Rfid r;
    
    public listenReader(Rfid rr){
        r=rr;
    start();
    }
    
    public void run(){
    
    while(true)
    {
    
        String tag=Rfid.tfRfid.getText();
        //System.out.println("tag>"+tag);
    if(!tag.equals("") && tag.length()==12)
    {
     String urlString = "";
                         try
			      {
                               
                                  
                                 DBQuery db=new DBQuery();
                                 String pin=db.verify_rfid(tag);
                                  
                                  if(pin.equals(""))
                                  {
                                  
                                  JOptionPane.showMessageDialog(null,"No Tag present");
                                  
                                  
                                  }
                                  else{
                                      System.out.println(".........."+pin);
                                  new user_type(pin,tag).setVisible(true);
                                  r.setVisible(false);
                                  }
                                  
                                  
			      }catch(Exception e)
			      {
			         e.printStackTrace();
			      }
               
    Rfid.tfRfid.setText("");
    }
            try {
                Thread.sleep(1000);
            } catch (InterruptedException ex) {
                Logger.getLogger(listenReader.class.getName()).log(Level.SEVERE, null, ex);
            }
    }
    }
    
}
