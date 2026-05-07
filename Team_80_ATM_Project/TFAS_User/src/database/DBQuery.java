package database;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public class DBQuery {
public Connection con=null;
public Statement st=null;
public ResultSet rs=null;
	
	public String verify_rfid(String rfid) throws ClassNotFoundException, SQLException{
		String pin="";
		con=DBConnection.getConnection();
		st=con.createStatement();
		String q="select * from adduser where rfid='"+rfid+"'";
		rs=st.executeQuery(q);
                
                if(rs.next())
                {
                pin=rs.getString("pin");
                
                }
		return pin;
	}
        
        
        public int verify_otp(String rfid,String mob,String otp) throws ClassNotFoundException, SQLException
        {
        int i=0;
        
        con=DBConnection.getConnection();
		st=con.createStatement();
        
                String q="select * from otp where tag='"+rfid+"' and mob='"+mob+"' and ot='"+otp+"'";
                
                rs=st.executeQuery(q);
                if(rs.next())
                {
                
                i=1;
                }
        
        return i;
        }
        
        public int get_balance(String ac) throws ClassNotFoundException, SQLException{
        
        
          int i=0;
        
                con=DBConnection.getConnection();
		st=con.createStatement();
        
                String q="select * from balance where acNo='"+ac+"'";
                
                rs=st.executeQuery(q);
                if(rs.next())
                {
                
                i=rs.getInt("balance");
                }
        
        return i;
        
        }
        
public String get_ac_num(String q) throws ClassNotFoundException, SQLException{
        
        
          String res="";
        
                con=DBConnection.getConnection();
		st=con.createStatement();
        
                
                
                rs=st.executeQuery(q);
                if(rs.next())
                {
                
                res=rs.getString(1);
                }
        
        return res;
        
        }
}
