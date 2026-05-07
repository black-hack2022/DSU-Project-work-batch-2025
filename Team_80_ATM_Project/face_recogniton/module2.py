import numpy as np
import time
import os
import math
import face_recognition
from joblib import dump, load
from sklearn import svm
 

encodings = []
names = []

train_dir = os.listdir("C:/Users/Rahul/Downloads/ATM WITH FACE FINGER PRINT/face_recogniton/Dataset")

for person in train_dir:
    pix = os.listdir("C:/Users/Rahul/Downloads/ATM WITH FACE FINGER PRINT/face_recogniton/Dataset/"+person)
    for person_img in pix:
        face = face_recognition.load_image_file("C:/Users/Rahul/Downloads/ATM WITH FACE FINGER PRINT/face_recogniton/Dataset/" + person + "/" + person_img)
        face_bounding_boxes = face_recognition.face_locations(face)

        if len(face_bounding_boxes) == 1:
            face_enc = face_recognition.face_encodings(face)[0]
            encodings.append(face_enc)
            names.append(person)
        else:
            print(person + "/" + person_img + " was skipped and can't be used for training")

clf = svm.SVC(gamma='scale')
clf.fit(encodings,names)
dump(clf,'Train.Model')

test_image = face_recognition.load_image_file('Test/a.jpg')
face_locations = face_recognition.face_locations(test_image)
no = len(face_locations)
print("Number of faces detected: ", no)
print("Found:")
for i in range(no):
    test_image_enc = face_recognition.face_encodings(test_image)[i]
    name = clf.predict([test_image_enc])
    print(*name)
