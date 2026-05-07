/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package logic;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.math.BigInteger;
import java.security.PrivateKey;
import java.sql.Connection;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import rsa.EncryptionUntil;


/**
 *
 * @author User
 */
public class DBQuery {
    public static final String PRIVATE_KEY_FILE = "C:/keys/private.key";
    DBConnection db=new DBConnection();
    Statement st=null;
    Statement st1=null;
    ResultSet rs=null;
    String ss[]=new String[20];
    String dbUser="",dbPass="",utype="";
    public int loginCheck(String user,String pass) throws ClassNotFoundException, SQLException
    {
    int i=0;
    Connection con=db.getConnection();
    st=con.createStatement();
    String q="select * from login where username='"+user+"' and password='"+pass+"'";
    rs=st.executeQuery(q);
    while(rs.next())
    {
     dbUser=rs.getString("username");
     dbPass=rs.getString("password");
     utype=rs.getString("utype");
    
    }
    if(user.equals(dbUser)&& pass.equals(dbPass))
    {
    if(utype.equals("admin"))
    {
    i=1;   
    }
    else{
    i=0;
    }
    
    }
    else{
    i=0;
    }
    return i;
    }
    public String rfidCheck(String user,String rfid) throws ClassNotFoundException, SQLException
    {
    int i=0;String dbrfid="",status="";
    Connection con=db.getConnection();
    st=con.createStatement();
    String q="select * from login where username='"+user+"' and rfid='"+rfid+"'";
    rs=st.executeQuery(q);
    while(rs.next())
    {
     dbUser=rs.getString("username");
     dbrfid=rs.getString("rfid");
   //  utype=rs.getString("utype");
    
    }
    if(user.equals(dbUser)&& rfid.equals(dbrfid))
    {
    
    status="OK";
    }
    else{
    status="NOTOK";
    }
    return status;
    }
    public int[] register_user(String fn,String ln,String uname,String ac,String d,String m,String y,String sex,String a1,String city,String pin,String mob,String email,String ps,String rf) throws ClassNotFoundException, SQLException
    {
    int i=0,j=0;
   int[] ii = new int[2] ;
    String dob=d+"-"+m+"-"+"-"+y;
    generatePin gp=new generatePin();
    int pincode=gp.getPin();
    int acc=Integer.parseInt(ac);
    Connection con=db.getConnection();
    st=con.createStatement();
    String type="user";
    String qq="select * from login where username='"+uname+"'";
    rs=st.executeQuery(qq);
    while(rs.next()){
    i=1;
    }
    String q="insert into user_details values('"+fn+"','"+ln+"','"+uname+"','"+acc+"','"+dob+"','"+sex+"','"+a1+"','"+city+"','"+pin+"','"+mob+"','"+email+"','"+ps+"','"+pincode+"','"+rf+"')";
    String q1="insert into login values('"+uname+"','"+ps+"','"+pincode+"','"+acc+"','"+rf+"','"+type+"')";
   if(i==1){
    j=0;
    
   }
   else{
   j=st.executeUpdate(q);
    st.executeUpdate(q1);
    j=1;
     ii[0]=j;
     ii[1]=pincode;
   }
        
    return ii;
    }
    public int modify_user(String fn,String ln,String uname,String ac,String d,String m,String y,String sex,String a1,String city,String pin,String mob,String email,String ps,String rf) throws ClassNotFoundException, SQLException
    {
    int i=0,j=0;
    
    String dob=d+"-"+m+"-"+"-"+y;
    
   // int pincd=Integer.parseInt(pincode);
    int acc=Integer.parseInt(ac);
    Connection con=db.getConnection();
    st=con.createStatement();
    String type="user";
    
    String q="update user_details set fname='"+fn+"',lname='"+ln+"',acNo='"+acc+"',dob='"+dob+"',sex='"+sex+"',add1='"+a1+"',city='"+city+"',pin='"+pin+"',mobile='"+mob+"',email='"+email+"',password='"+ps+"',rfid='"+rf+"' where username='"+uname+"'";
    String q1="update login set password='"+ps+"',acNo='"+acc+"',rfid='"+rf+"' where username='"+uname+"'";
    st.executeUpdate(q1);
   j=st.executeUpdate(q);
   
     
        
    return j;
    }
    
    
    public String[] getUserDetails(String uname) throws ClassNotFoundException, SQLException{
    Connection con=db.getConnection();
    st=con.createStatement();
    String d="select * from user_details where username='"+uname+"'";
    rs=st.executeQuery(d);
    while(rs.next()){
    ss[0]=rs.getString("fname");
    ss[1]=rs.getString("lname");
    ss[2]=rs.getInt("acNo")+"";
    ss[3]=rs.getString("dob");
    ss[4]=rs.getString("sex");
    ss[5]=rs.getString("add1");
    ss[6]=rs.getString("city");
    ss[7]=rs.getInt("pin")+"";
    ss[8]=rs.getString("mobile");
    ss[9]=rs.getString("email");
    ss[10]=rs.getString("password");
    ss[11]=rs.getInt("pincode")+"";
    ss[12]=rs.getString("rfid");
    
    
    }
    
    
    return ss;
    }
    
    
    
    public int deleteUser(String ac) throws ClassNotFoundException, SQLException{
    int i=0;
    Connection con=db.getConnection();
    st=con.createStatement();
    st1=con.createStatement();
    
    String q="delete from user_details where acNo='"+ac+"'";
    String q1="delete from login where acNo='"+ac+"'";
    String q2="delete from balance where acNo='"+ac+"'";
    st1.executeUpdate(q1);
    st1.executeUpdate(q2);
    i=st.executeUpdate(q);
    
    
    return i;
    
    }
    public int UserloginCheck(byte[] user,byte[] pass) throws ClassNotFoundException, SQLException, IOException
    {
    int i=0;
    Connection con=db.getConnection();
    st=con.createStatement();
    String u="",p="";
    
  /*  RSA r=new RSA(1024);
    
    BigInteger plaintext= r.decrypt(user);
    u = new String(plaintext.toByteArray());
    System.out.println("Plaintext: " + u);
    
    BigInteger plainpass= r.decrypt(pass);
    p = new String(plainpass.toByteArray());
    System.out.println("Plainpass: " + p);*/
    
    EncryptionUntil e=new EncryptionUntil();
    ObjectInputStream inputStream = null;
    inputStream = new ObjectInputStream(new FileInputStream(PRIVATE_KEY_FILE));
      final PrivateKey privateKey = (PrivateKey) inputStream.readObject();
      final String plainuser = EncryptionUntil.decrypt(user, privateKey);
      final String plainpass = EncryptionUntil.decrypt(pass, privateKey);
    
    
    
    String q="select * from login where username='"+plainuser+"' and pin='"+plainpass+"'";
    rs=st.executeQuery(q);
    while(rs.next())
    {
     dbUser=rs.getString("username");
     dbPass=rs.getString("pin");
     utype=rs.getString("utype");
        System.out.println("KK>"+dbUser+dbPass+utype);
    
    }
    if(plainuser.equals(dbUser)&& plainpass.equals(dbPass))
    {
    if(utype.equals("user"))
    {
    i=1;   
    }
    else{
    i=0;
    }
    
    }
    else{
    i=0;
    }
        System.out.println("%%%%>"+i);
    return i;
    }
    public String getPassword(String user) throws ClassNotFoundException, SQLException{
    String s="";
    Connection con=db.getConnection();
    st=con.createStatement();
    
    String q="select pin from adduser where rfid='"+user+"'";
    rs=st.executeQuery(q);
    while(rs.next()){
    s=rs.getString("pin");
    }
    return s;
    
    }
    public String getAc(String user) throws ClassNotFoundException, SQLException{
    String s="";int i=0;
    Connection con=db.getConnection();
    st=con.createStatement();
    
    String q="select acNo from balance where acNo='"+user+"'";
    rs=st.executeQuery(q);
    while(rs.next()){
    s=rs.getString("acNo");
    }
    return s;
    
    }
    public String getUser(String ac) throws ClassNotFoundException, SQLException{
    String s="";int i=0;
    Connection con=db.getConnection();
    st=con.createStatement();
    
    String q="select * from login where acNo='"+ac+"'";
    rs=st.executeQuery(q);
    while(rs.next()){
    s=rs.getString("username");
    }
    return s;
    
    }
    public String getBalance(String user) throws ClassNotFoundException, SQLException{
    String s="";
    Connection con=db.getConnection();
    st=con.createStatement();
    
    String q="select balance from balance where acNo='"+user+"'";
    rs=st.executeQuery(q);
    while(rs.next()){
    s=rs.getString("balance");
    }
    return s;
    
    }
    public int update_balance(String ac,String username,String bal) throws ClassNotFoundException, SQLException
    {
    int i=0;
    int oBal=0; 
    int acc=Integer.parseInt(ac);
    int amt=Integer.parseInt(bal);
    Connection con=db.getConnection();
    st=con.createStatement();
    Statement st1=con.createStatement();
    String type="user";
    String u1="select * from balance where acNo='"+acc+"'";
   ResultSet rs=st1.executeQuery(u1);
   while(rs.next()){
   oBal=rs.getInt("balance");
   }
        System.out.println("nnnn>"+oBal);
        if(oBal==0){
        String u2="insert into balance values('"+username+"','"+acc+"','"+amt+"')";
       i=st.executeUpdate(u2);
        
        }
        else{
   amt=oBal+amt;
    String u="update balance set balance='"+amt+"' where acNo='"+acc+"'";
    i=st.executeUpdate(u);
        }
        String user=getUser(ac);
      //  Date d=new Date();
        String qq="insert into transaction values('"+user+"')";
    //st.executeUpdate(q1);
   // int ii[]={i,pincode};
    return i;
    }
    public int withdraw_cash(String user,String bal) throws ClassNotFoundException, SQLException
    {
    int i=0;
    int flag=0;
    int oBal=0; 
    String acc=getAc(user);
    int amt=Integer.parseInt(bal);
    String type="user";
    
    Connection con=db.getConnection();
    st=con.createStatement();
    Statement st1=con.createStatement();
    
    Calendar currentDate = Calendar.getInstance();
    SimpleDateFormat formatter= new SimpleDateFormat("yyyy/MMM/dd HH:mm:ss");
    String dateNow = formatter.format(currentDate.getTime());
    System.out.println("Now the date is :=>  " + dateNow);
    String dat=dateNow.substring(0, 11);
    System.out.println("dat::"+dat);
    
    
    
    
    String q1="select flag from transaction where username='"+user+"' and date='"+dat+"'";
    ResultSet rsd=st1.executeQuery(q1);
    while(rsd.next()){
    flag=rsd.getInt("flag");
    System.out.println("flag"+flag);
    }
    
    if(flag==0||flag<5)
    {
    //flag=1;
        flag++;
    String u1="select * from balance where acNo='"+acc+"'";
     rs=st1.executeQuery(u1);
    while(rs.next()){
    oBal=rs.getInt("balance");
    }
        System.out.println("nnnn>"+oBal);
        if(oBal==0&&oBal<500){
        i=5;
        
        }
        else if(amt<oBal)
        {
           amt=oBal-amt;
           String u="update balance set balance='"+amt+"' where acNo='"+acc+"'";
           i=st.executeUpdate(u);
        }
        
          String tran="Cash Withdraw";
          String qq1="insert into transaction values('"+user+"','"+dat+"','"+tran+"','"+flag+"',"+bal+")";
        //String qq="update transaction set flag='"+flag+"' where username='"+user+"' and date='"+dat+"'";
        //if(flag==1){
          st.executeUpdate(qq1);
      //  }
      //  else{
      //  st.executeUpdate(qq);
        
      //  }
    }
    else if(flag>=5)
    {
        i=5;
        System.out.println("............"+i);
    }
    else{
    flag++;
    String u1="select * from balance where acNo='"+acc+"'";
    ResultSet rs=st1.executeQuery(u1);
    while(rs.next()){
    oBal=rs.getInt("balance");
    }
        System.out.println("nnnn>"+oBal);
        if(oBal==0&&oBal<500){
        i=5;
        
        }
        else if(amt>oBal){
    amt=oBal-amt;
    String u="update balance set balance='"+amt+"' where acNo='"+acc+"'";
    i=st.executeUpdate(u);
    
        }
        
        String tran="Cash Withdraw";
        
        String qq1="insert into transaction values('"+user+"','"+dat+"','"+tran+"','"+flag+"')";
        String qq="update transaction set flag='"+flag+"' where username='"+user+"' and date='"+dat+"'";
      //  if(flag==1){
        st.executeUpdate(qq1);
        //}
       // else{
        st.executeUpdate(qq);
     //  
        //}
    }
    
        System.out.println("***************"+i);
    return i;
    }
      public String verify_rfid(String user) throws ClassNotFoundException, SQLException{
    String s="";
    Connection con=db.getConnection();
    st=con.createStatement();
    
    String q="select * from addUser where aadhaar='"+user+"'";
    rs=st.executeQuery(q);
    while(rs.next()){
    s=rs.getString("pin");
    }
    return s;
    
    }
}
