package com.digitalpersona.onetouch.ui.swing.sample.Enrollment;

import java.io.*;
import java.beans.*;
import java.awt.*;
import java.awt.event.*;
import javax.swing.*;
import com.digitalpersona.onetouch.*;
import java.util.logging.Level;
import java.util.logging.Logger;
import logic.path_info;

public class MainForm extends JFrame
{
	public static String TEMPLATE_PROPERTY = "template";
	private DPFPTemplate template;
public  String user="";
	public class TemplateFileFilter extends javax.swing.filechooser.FileFilter {
		@Override public boolean accept(File f) {
			return f.getName().endsWith(".fpt");
		}
		@Override public String getDescription() {
			return "Fingerprint Template File (*.fpt)";
		}
	}
	public MainForm(String user1) throws FileNotFoundException, IOException {
            this.user=user1;
        setState(Frame.NORMAL);
        setDefaultCloseOperation(WindowConstants.HIDE_ON_CLOSE);
		this.setTitle("Fingerprint Enrollment and Verification Sample");
		setResizable(false);

		final JButton enroll = new JButton("Fingerprint Enrollment");
        enroll.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent e) { onEnroll(); }});
		
		final JButton verify = new JButton("Fingerprint Verification");
        verify.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent e) {try {
                    onVerify();
                } catch (FileNotFoundException ex) {
                    Logger.getLogger(MainForm.class.getName()).log(Level.SEVERE, null, ex);
                } catch (IOException ex) {
                    Logger.getLogger(MainForm.class.getName()).log(Level.SEVERE, null, ex);
                }
 }});

		final JButton save = new JButton("Save Fingerprint Template");
        save.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent e) {try {
                    onSave(user);
                } catch (FileNotFoundException ex) {
                    Logger.getLogger(MainForm.class.getName()).log(Level.SEVERE, null, ex);
                } catch (IOException ex) {
                    Logger.getLogger(MainForm.class.getName()).log(Level.SEVERE, null, ex);
                }
 }});

		final JButton load = new JButton("Read Fingerprint Template");
        load.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent e) { onLoad(user); }});

		final JButton quit = new JButton("Close");
        quit.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent e) {//System.exit(0); 
          // this.setVisible(false);
            }});
		
		this.addPropertyChangeListener(TEMPLATE_PROPERTY, new PropertyChangeListener() {
			public void propertyChange(PropertyChangeEvent evt) {
				enroll.setEnabled(template != null);
				save.setEnabled(template != null);
				if (evt.getNewValue() == evt.getOldValue()) return;
				//if (template != null)
					//JOptionPane.showMessageDialog(MainForm.this, "The fingerprint template is ready for fingerprint verification.", "Fingerprint Enrollment", JOptionPane.INFORMATION_MESSAGE);
			}
		});
			
		JPanel center = new JPanel();
		center.setLayout(new GridLayout(4, 1, 0, 5));
		center.setBorder(BorderFactory.createEmptyBorder(20, 20, 5, 20));
		center.add(enroll);
		center.add(verify);
		center.add(save);
		center.add(load);
		
		JPanel bottom = new JPanel(new FlowLayout(FlowLayout.TRAILING));
		bottom.setBorder(BorderFactory.createEmptyBorder(5, 20, 5, 20));
		bottom.add(quit);

		setLayout(new BorderLayout());
		add(center, BorderLayout.CENTER);
		add(bottom, BorderLayout.PAGE_END);
		
		pack();
		setSize((int)(getSize().width*1.6), getSize().height);
        setLocationRelativeTo(null);
//		setTemplate(null);
		setVisible(true);
                onVerify();
	}
	
	private void onEnroll() {
		EnrollmentForm form = new EnrollmentForm(this);
		form.setVisible(true);
	}

	private void onVerify() throws FileNotFoundException, IOException {
           // onSave(user);
            onLoad(user);
            VerificationForm.user=user;
		VerificationForm form = new VerificationForm(this);
                
		form.setVisible(true);
                this.dispose();
	}

	private void onSave(String user) throws FileNotFoundException, IOException {
		//JFileChooser chooser = new JFileChooser();
		//chooser.addChoosableFileFilter(new TemplateFileFilter());
		//while (true) {
		//	if (chooser.showSaveDialog(this) == JFileChooser.APPROVE_OPTION) {
				//try {
					//File file = chooser.getSelectedFile();
					//if (!file.toString().toLowerCase().endsWith(".fpt"))
					File	file = new File("F:/atm/storedImages/"+user+"/"+user+".fpt");
				/*	if (file.exists()) {
						int choice = JOptionPane.showConfirmDialog(this,
							String.format("File \"%1$s\" already exists.\nDo you want to replace it?", file.toString()),
							"Fingerprint saving", 
							JOptionPane.YES_NO_CANCEL_OPTION);
						if (choice == JOptionPane.NO_OPTION)
							continue;
						else if (choice == JOptionPane.CANCEL_OPTION)
							break;
					}*/
					FileOutputStream stream = new FileOutputStream(file);
					stream.write(getTemplate().serialize());
					stream.close();
				//} catch (Exception ex) {
				//	JOptionPane.showMessageDialog(this, ex.getLocalizedMessage(), "Fingerprint saving", JOptionPane.ERROR_MESSAGE);
				//}
			//}
		//	break;
		//}
	}

	private void onLoad(String user) {
        FileInputStream stream = null;
        try {
            System.out.println("sss:"+user);
            System.out.println(path_info.path+"finger_prints/"+user+"/"+user+".fpt");
            stream = new FileInputStream(path_info.path+"finger_prints//"+user+"/"+user+".fpt");
            byte[] data = new byte[stream.available()];
            stream.read(data);
            stream.close();
            DPFPTemplate t = DPFPGlobal.getTemplateFactory().createTemplate();
            t.deserialize(data);
            setTemplate(t);
            System.out.println("success");
            
            
     } catch (Exception ex) {
          //  JOptionPane.showMessageDialog(this, ex.getLocalizedMessage(), "Fingerprint loading", JOptionPane.ERROR_MESSAGE);
    } 
	}
	
	public DPFPTemplate getTemplate() {
		return template;
	}
	public void setTemplate(DPFPTemplate template) {
		DPFPTemplate old = this.template;
		this.template = template;
		firePropertyChange(TEMPLATE_PROPERTY, old, template);
	}
	
    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) {
        SwingUtilities.invokeLater(new Runnable() {
            public void run() {
               // new MainForm();
            }
        });
    }

}
