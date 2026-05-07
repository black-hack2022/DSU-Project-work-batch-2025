/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package logic;

//import admin.MainForm;
import admin.adminHome;
import admin.adminLogin;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.swing.JFrame;

/**
 *
 * @author Admin
 */
public class rotate extends Thread{
   public static int c=1; 
   JFrame jf=null;
    public rotate(JFrame f){
    this.jf=f;
    start();
    }
    public void run(){
    int i=1;
    for(int t=0;t<5;t++)
    {
            try {
                loop();
                Thread.sleep(500);
                if(rotate.c==5){
                    
                    System.out.println("1>>"+rotate.c);
                new adminLogin().setVisible(true);
                jf.dispose();
                break;
                }
            } catch (InterruptedException ex) {
                Logger.getLogger(rotate.class.getName()).log(Level.SEVERE, null, ex);
            }
    }
    }
     public void loop(){
     
     int x=c;
     x++;
     rotate.c=x;
     }   
}
